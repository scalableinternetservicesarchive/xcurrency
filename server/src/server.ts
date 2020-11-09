require('honeycomb-beeline')({
  writeKey: process.env.HONEYCOMB_KEY || 'd29d5f5ec24178320dae437383480737',
  dataset: process.env.APP_NAME || 'bespin',
  serviceName: process.env.APPSERVER_TAG || 'local',
  enabledInstrumentations: ['express', 'mysql2', 'react-dom/server'],
  sampleRate: 10,
})

import assert from 'assert'
import * as bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { json, raw, RequestHandler, static as expressStatic } from 'express'
import { getOperationAST, parse as parseGraphql, specifiedRules, subscribe as gqlSubscribe, validate } from 'graphql'
import { GraphQLServer } from 'graphql-yoga'
import { forAwaitEach, isAsyncIterable } from 'iterall'
import path from 'path'
import 'reflect-metadata'
import { v4 as uuidv4 } from 'uuid'
import { checkEqual, Unpromise } from '../../common/src/util'
import { Config } from './config'
import { migrate } from './db/migrate'
import { initORM, query, transaction } from './db/sql'
import { Account } from './entities/Accounts'
import { Session } from './entities/Session'
import { User } from './entities/User'
import { getSchema, graphqlRoot, pubsub } from './graphql/api'
import { ConnectionManager } from './graphql/ConnectionManager'
import { AccountType } from './graphql/schema.types'
import { expressLambdaProxy } from './lambda/handler'
import { renderApp } from './render'

const plaid = require('plaid')

const plaidClient = new plaid.Client({
  clientID: Config.plaidClientKey,
  secret: Config.plaidSandboxKey,
  env: plaid.environments.sandbox,
})

const server = new GraphQLServer({
  typeDefs: getSchema(),
  resolvers: graphqlRoot as any,
  context: ctx => ({ ...ctx, pubsub, user: (ctx.request as any)?.user || null }),
})

server.express.use(cookieParser())
server.express.use(json())
server.express.use(raw())
server.express.use('/app', cors(), expressStatic(path.join(__dirname, '../../public')))

const asyncRoute = (fn: RequestHandler) => (...args: Parameters<RequestHandler>) =>
  fn(args[0], args[1], args[2]).catch(args[2])

server.express.get('/', (req, res) => {
  console.log('GET /')
  res.redirect('/app')
})

server.express.get('/app/*', (req, res) => {
  console.log('GET /app')
  renderApp(req, res)
})

server.express.post(
  '/auth/login',
  asyncRoute(async (req, res) => {
    console.log('POST /auth/login')
    const email = req.body.email
    const password = req.body.password

    const user = await User.findOne({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(403).send('Forbidden')
      return
    }

    const authToken = uuidv4()

    await Session.delete({ user })

    const session = new Session()
    session.authToken = authToken
    session.user = user
    await Session.save(session).then(s => console.log('saved session ' + s.id))

    const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days
    res
      .status(200)
      .cookie('authToken', authToken, { maxAge: SESSION_DURATION, path: '/', httpOnly: true, secure: Config.isProd })
      .send('Success!')
  })
)

server.express.post(
  '/auth/signup',
  asyncRoute(async (req, res) => {
    console.log('POST /auth/signup')

    const { name, email, password } = req.body
    const user = await User.findOne({ where: { email } })
    if (user) {
      console.log('Already found user in the database!')
      return res.sendStatus(400)
    }
    await User.insert({ name, email, password })
    console.log('Inserted user into database!')
    return res.status(200).send('Success!')
  })
)

/*
server.express.post(
'/confirm-request',
asyncRoute(async (req, res) => {
  //handle request
  //verify if have enough money
  //yes, substract money, generate ID for the request, and store request in DB.
  //no, route to a not enough page

})
) */

/*
server.express.get('/requests',async (req,res) => {
	const requests = await Requests.find()
	res.status(200).type('json').send(requests)
})
*/

server.express.post(
  '/auth/logout',
  asyncRoute(async (req, res) => {
    console.log('POST /auth/logout')
    const authToken = req.cookies.authToken
    if (authToken) {
      await Session.delete({ authToken })
    }
    res.status(200).cookie('authToken', '', { maxAge: 0 }).send('Success!')
  })
)

server.express.get(
  '/api/:function',
  asyncRoute(async (req, res) => {
    console.log(`GET ${req.path}`)
    const { statusCode, headers, body } = await expressLambdaProxy(req)
    res
      .status(statusCode)
      .contentType(String(headers?.['Content-Type'] || 'text/plain'))
      .send(body)
  })
)

server.express.post(
  '/api/:function',
  asyncRoute(async (req, res) => {
    console.log(`POST ${req.path}`)
    const { statusCode, headers, body } = await expressLambdaProxy(req)
    res
      .status(statusCode)
      .contentType(String(headers?.['Content-Type'] || 'text/plain'))
      .send(body)
  })
)

server.express.post('/graphqlsubscription/connect', (req, res) => {
  console.log('POST /graphqlsubscription/connect')
  ConnectionManager.connect(req)
  res.status(200).header('Sec-WebSocket-Protocol', 'graphql-ws').send('')
})

server.express.post('/graphqlsubscription/connection_init', (req, res) => {
  console.log('POST /graphqlsubscription/connection_init')
  res.status(200).send(JSON.stringify({ type: 'connection_ack' }))
})

server.express.post(
  '/graphqlsubscription/start',
  asyncRoute(async (req, res) => {
    console.log('POST /graphqlsubscription/start')
    const connId = ConnectionManager.getConnId(req)

    const { id, payload } = req.body
    // If we already have a subscription with this id, unsubscribe from it first.
    ConnectionManager.endSubscription(connId, id)

    const { query, variables, operationName } = payload
    const document = parseGraphql(query)
    const operationAST = getOperationAST(document, operationName)
    checkEqual(
      'subscription',
      operationAST?.operation,
      'expected a subscription graphql operation, got: ' + operationAST?.operation
    )

    let subscription: Unpromise<ReturnType<typeof gqlSubscribe>>
    try {
      const validationErrors = validate(server.executableSchema, document, [...specifiedRules])
      if (validationErrors.length > 0) {
        throw {
          errors: validationErrors,
        }
      }

      subscription = await gqlSubscribe({
        contextValue: { pubsub },
        document,
        operationName,
        rootValue: graphqlRoot,
        schema: server.executableSchema,
        variableValues: variables,
      })
    } catch (e) {
      if (e.errors) {
        await ConnectionManager.send(connId, JSON.stringify({ id, type: 'data', payload: { errors: e.errors } }))
      } else {
        await ConnectionManager.send(connId, JSON.stringify({ id, type: 'error', payload: { message: e.message } }))
      }

      // Remove the operation on the server side as it will be removed also in the client.
      ConnectionManager.endSubscription(connId, id)
      throw e
    }

    assert.ok(isAsyncIterable(subscription))
    ConnectionManager.registerSubscription(connId, id, subscription)

    forAwaitEach(subscription, payload => ConnectionManager.send(connId, JSON.stringify({ id, type: 'data', payload })))
      .then(() => ConnectionManager.send(connId, JSON.stringify({ id, type: 'complete' })))
      .catch((e: Error) => {
        let error = e
        if (Object.keys(error).length === 0) {
          // plain Error object cannot be JSON stringified.
          error = { name: error.name, message: error.message }
        }
        return ConnectionManager.send(connId, JSON.stringify({ id, type: 'error', payload: error }))
      })

    res.status(200).send('')
  })
)

server.express.post('/graphqlsubscription/stop', (req, res) => {
  console.log('POST /graphqlsubscription/stop')
  const connId = ConnectionManager.getConnId(req)
  const { id } = req.body
  ConnectionManager.endSubscription(connId, id)
  res.status(200).send('')
})

server.express.post('/graphqlsubscription/disconnect', (req, res) => {
  console.log('POST /graphqlsubscription/disconnect')
  ConnectionManager.disconnect(req)
  res.status(200).send('')
})

server.express.post(
  '/graphql',
  asyncRoute(async (req, res, next) => {
    const authToken = req.cookies.authToken || req.header('x-authtoken')
    if (authToken) {
      const session = await Session.findOne({ where: { authToken }, relations: ['user'] })
      if (session) {
        const reqAny = req as any
        reqAny.user = session.user
      }
    }
    next()
  })
)

server.express.post('/getPlaidLinkToken', async (req: any, res) => {
  const authToken = req.cookies.authToken || req.header('x-authtoken')
  if (authToken) {
    const session = await Session.findOne({ where: { authToken }, relations: ['user'] })
    if (session) {
      const clientUserId = session.user.id
      try {
        const tokenResponse = await plaidClient.createLinkToken({
          user: {
            client_user_id: String(clientUserId),
          },
          client_name: 'XCurrency',
          products: ['auth'],
          country_codes: ['US'],
          language: 'en',
          webhook: 'https://webhook.sample.com',
        })
        return res.send({ link_token: tokenResponse.link_token })
      } catch (e) {
        return res.send({ error: e.message })
      }
    } else {
      return res.send({ error: 'No session associated with the logged in user could be found!' })
    }
  } else {
    return res.send({ error: 'No authentication cookie could be found! Please try logging in.' })
  }
})

server.express.post('/getPlaidAccessToken', async (req, res) => {
  try {
    const publicToken = req.body.public_token
    // Exchange the client-side public_token for a server access_token
    const tokenResponse = await plaidClient.exchangePublicToken(publicToken)
    // Save the access_token and item_id to a persistent database
    const accessToken = tokenResponse.access_token

    const authToken = req.cookies.authToken || req.header('x-authtoken')
    if (authToken) {
      const session = await Session.findOne({ where: { authToken }, relations: ['user'] })
      if (session) {
        // save the access token for future use
        const user = session.user
        user.plaidAccessToken = accessToken
        await user.save()

        // retrieve balances of all accounts
        const { accounts } = await plaidClient.getAccounts(accessToken)

        for (const account of accounts) {
          if (account.subtype === 'savings' || account.subtype == 'checking') {
            const existingExternalAccount = await Account.findOne({
              where: { name: account.name, user: user, type: AccountType.External },
            })
            if (!existingExternalAccount) {
              // Create the external account
              let { current: balance, iso_currency_code } = account.balances
              await Account.insert({
                name: `${account.name} - ${iso_currency_code}`,
                country: iso_currency_code,
                balance,
                user,
                type: AccountType.External,
              })

              // Create the internal account if needed
              const existingInternalAccount = await query(
                `SELECT accountId FROM account
                WHERE account.userId = ${user.id} and
                account.country = '${iso_currency_code}' and
                account.type = '${AccountType.Internal}'`
              )
              if (existingInternalAccount.length == 0) {
                await Account.insert({
                  country: iso_currency_code,
                  name: `Multicurrency Account - ${iso_currency_code}`,
                  balance: 0,
                  user,
                  type: AccountType.Internal,
                })
              }
            }
          }
        }
      }
    }
  } catch (e) {
    return res.send({ error: e.message })
  }
  return res.sendStatus(200)
})

server.express.post('/transferBalance', async (req, res) => {
  const { fromAccountId, toAccountId, amount } = req.body
  await transaction(async () => {
    const fromAccount = await Account.findOne({ where: { accountId: fromAccountId } })
    if (!fromAccount) {
      return res.status(400).send({ error: 'The account to transfer funds from does not exist!' })
    }
    const toAccount = await Account.findOne({ where: { accountId: toAccountId } })
    if (!toAccount) {
      return res.status(400).send({ error: 'The account to transfer funds to does not exist!' })
    }
    if (fromAccount.balance < amount) {
      return res.status(400).send({ error: 'Insufficient funds!' })
    }

    fromAccount.balance -= amount
    await fromAccount.save()
    toAccount.balance += amount
    await toAccount.save()

    return res.sendStatus(200)
  })
})

initORM()
  .then(() => migrate())
  .then(() =>
    server.start(
      {
        port: Config.appserverPort,
        endpoint: '/graphql',
        subscriptions: '/graphqlsubscription',
        playground: '/graphql',
      },
      () => {
        console.log(`server started on http://localhost:${Config.appserverPort}/`)
      }
    )
  )
  .catch(err => console.error(err))
