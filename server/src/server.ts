require('honeycomb-beeline')({
  writeKey: process.env.HONEYCOMB_KEY || '3ebf1b9f559d527d8eb3b0e08d859a8e',
  dataset: process.env.APP_NAME || 'bespin',
  serviceName: process.env.APPSERVER_TAG || 'local',
  enabledInstrumentations: ['express', 'mysql2', 'react-dom/server'],
  sampleRate: 10,
})

import assert from 'assert'
import * as bcrypt from 'bcrypt'
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
import { ExchangeRequest } from './entities/ExchangeRequest'
import { Session } from './entities/Session'
import { User } from './entities/User'
import { checkForMatch, exReq } from './exchangeAlgorithm'
import { getSchema, graphqlRoot, pubsub } from './graphql/api'
import { ConnectionManager } from './graphql/ConnectionManager'
import { AccountType, UserType } from './graphql/schema.types'
import { expressLambdaProxy } from './lambda/handler'
import { renderApp } from './render'

//maximum amount of divation of a curreny in a single transaction.
let moneyDeviationPara = new Map()
moneyDeviationPara.set('USD', 20)
moneyDeviationPara.set('CAD', 26)
moneyDeviationPara.set('JPY', 2100)
moneyDeviationPara.set('BRL', 110)
moneyDeviationPara.set('INR', 1500)
moneyDeviationPara.set('CNY', 130)

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
  renderApp(req, res, server.executableSchema)
})

//=================used to seed users and admin for load testing purpose (loadCreateRequestPeruser.js)
//password: tester123456
async function seedDataForLoadCreateRequest(users : number) {
  for (let i =0; i<users; i++) {
    const obj = await User.insert({ email: `user${i}@gmail.com`, name: `VUser${i}`, password: '$2a$10$m9QP5Kon3qyDOvmsVG1CkOO28TPYw0gMnY1dWiD8ppZeZdguMdWHy', userType: UserType.User})
    const user = await User.findOne({ id : obj.generatedMaps[0].id })
    await Account.insert({ country: 'USD', type: AccountType.Internal, balance: 100000.00, name: 'whatever' , user: user  })
    await Account.insert({ country: 'CAD', type: AccountType.Internal, balance: 100000.00, name: 'whatever' , user: user  })
  }
}

server.express.get('/seedVusers', asyncRoute( async (req, res) =>{
  seedDataForLoadCreateRequest(300);
  res.status(200).send("successfully seeded")
}))

server.express.get('/seedAdmin', asyncRoute( async (req, res) => {
  const obj = await User.insert({ email: `admin@gmail.com`, name: `admin@hank`, password: '$2a$10$m9QP5Kon3qyDOvmsVG1CkOO28TPYw0gMnY1dWiD8ppZeZdguMdWHy', userType: UserType.Admin})
  const user = await User.findOne({ id : obj.generatedMaps[0].id })
  await Account.insert({ country: 'USD', type: AccountType.Internal, balance: 1000000.00, name: 'whatever' , user: user  })
  await Account.insert({ country: 'CAD', type: AccountType.Internal, balance: 1000000.00, name: 'whatever' , user: user  })
  res.status(200).send("successfully seeded")
}))



server.express.post(
  '/auth/login',
  asyncRoute(async (req, res) => {
    console.log('POST /auth/login')
    const email = req.body.email
    const password = req.body.password


    // const user = await User.findOne({ where: { email } })

    // const user =  (await query(
    //   `SELECT id, password FROM user
    //     WHERE user.email = '${email}'`
    // ))[0];

    const user = await User.createQueryBuilder("user").select("user.id").addSelect("user.password")
              .where("user.email = :email", { email })
              .getOne();

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
      .send({ authToken })
  })
)

server.express.post(
  '/auth/signup',
  asyncRoute(async (req, res) => {
    console.log('POST /auth/signup')

    const { name, email, password } = req.body
    // const user = await User.findOne({ where: { email } })
    const user = await User.createQueryBuilder("user").select("user.id")
      .where("user.email = :email", { email })
      .getOne();

    if (user) {
      console.log('Already found user in the database!')
      return res.sendStatus(400)
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    await User.insert({ name, email, password: hashedPassword })
    console.log('Inserted user into database!')
    return res.status(200).send('Success!')
  })
)


async function executeExchange(
  currentRate: number,
  requsterUser : User,
  userAccount: Account,
  userToAccount: Account,
  request: exReq,
  real_request: ExchangeRequest
) {
      const requestbidrate = Number(1 / request.bidRate);
      const exchangeRequests = await query('SELECT * from exchange_request where fromCurrency = ? and toCurrency = ? and bidRate <= ? and amountPay <= ? and amountPay >= ? and amountWant <= ? and amountWant >= ?',
       [request.toCurrency,
        request.fromCurrency,
        requestbidrate,
         Number(Number(moneyDeviationPara.get(request.toCurrency)) + Number(request.amountWant)),
        Number(Number(request.amountWant) - Number(moneyDeviationPara.get(request.toCurrency))),
        Number(Number(moneyDeviationPara.get(request.fromCurrency)) + Number(request.amountPay)),
        Number(Number(request.amountPay) - Number(moneyDeviationPara.get(request.fromCurrency)))])
      const match = await checkForMatch(request, exchangeRequests)

      if (match[0]) {
        //update admin account
        let adminUser_arr = await query('SELECT * from user where userType = ? LIMIT 1', [UserType.Admin])
        let adminUser = adminUser_arr[0]
        // parallel queries with Promise.all
        let [adminToAccount_arr, adminFromAccount_arr, exReq2_arr, secondUser_arr ]  =  await Promise.all([
        query('SELECT * from account where userId = ? and country = ? and type = ?', [adminUser.id,request.toCurrency,AccountType.Internal]),
        query('SELECT * from account where userId = ? and country = ? and type = ?', [adminUser.id,request.fromCurrency,AccountType.Internal]),
        query('SELECT * from exchange_request where requestId = ?', [match[0]]),
        query('SELECT * from user left join exchange_request on user.id = exchange_request.userId where exchange_request.requestId = ?', [match[0]])
      ])
      let adminToAccount = adminToAccount_arr[0]
      let adminFromAccount = adminFromAccount_arr[0]
      let exReq2 = exReq2_arr[0]
      let secondUser = secondUser_arr[0]
      // end parrallel queries
      let secondUserToAccount_arr = await query('SELECT * from account where account.userId = ? and country = ? and type = ?', [secondUser.id, exReq2.toCurrency, AccountType.Internal])
      let secondUserToAccount = secondUserToAccount_arr[0]
        if (adminToAccount) {
          if (adminFromAccount) {
            if (exReq2) {
              if (secondUser) {
                  if (secondUserToAccount) {
                    //update admin account
                    adminFromAccount.balance =
                      Number(adminFromAccount.balance) + Number(request.amountPay) - Number(exReq2.amountWant)
                    adminToAccount.balance =
                      Number(adminToAccount.balance) - Number(request.amountWant) + Number(exReq2.amountPay)
                    //update user1 (requester) account
                    userToAccount.balance = Number(userToAccount.balance) + Number(request.amountWant)
                    //update user2 account
                    secondUserToAccount.balance = Number(secondUserToAccount.balance) + Number(exReq2.amountWant)
                    await Promise.all([
                      await query('update account set balance = ? where userId = ? and country = ?',[userToAccount.balance, userToAccount.userId, userToAccount.country]),
                      await query('update account set balance = ? where userId = ? and country = ?', [secondUserToAccount.balance, secondUserToAccount.userId, secondUserToAccount.country]),
                      await query('update account set balance = ? where userId = ? and country = ?', [adminFromAccount.balance, adminFromAccount.userId, adminFromAccount.country]),
                      await query('update account set balance = ? where userId = ? and country = ?', [adminToAccount.balance, adminToAccount.userId, adminToAccount.country]),
                      await query('delete from exchange_request where requestId = ?', [real_request.requestId]),
                      await query('delete from exchange_request where requestId = ?', [exReq2.requestId]),
                      await query('insert into transaction_record (requestId1, requestId2, user1Id, user2Id) values (?,?,?,?)',
                       [requsterUser.id,secondUser.id, real_request.requestId, exReq2.requestId])
                    ])
                    }
              }
            }
          }
        }
      }
      else {
        //if no match, set bit flag to 'checked' in DB
        await query('update exchange_request set exchange_request.check = ? where requestId = ?', [true, real_request.requestId])
      }
}

async function findMatch() {
  await transaction(async () => {
  let request_arr = await query('SELECT * from exchange_request left join user on exchange_request.userId = user.id where exchange_request.check = ? limit 1', [false])
  let request = request_arr[0]
  console.log(request)
  if (request) {
    //run algorithm
    let userAccount_arr = await query('SELECT * from account left join user on user.id = account.userId where account.userId = ? and account.country = ? and account.type = ?',
    [request.userId, request.fromCurrency,AccountType.Internal])
    let userAccount = userAccount_arr[0]
  if (userAccount) {
    let userToAccount_arr = await query('SELECT * from account left join user on user.id = account.userId where account.userId = ? and account.country = ? and account.type = ?',
    [request.userId, request.toCurrency,AccountType.Internal])
    let userToAccount = userToAccount_arr[0]
    if (userToAccount) {
      const exReqData = new exReq(request.userId, request.bidRate, request.amountPay, request.amountWant, request.fromCurrency, request.toCurrency)
      await executeExchange(request.currentRate, request, userAccount, userToAccount, exReqData, request)
    } else {
      //no userToAccount, create a new account to store desire money
      const accountId = await query('INSERT INTO account (name, country, type, balance, userId) VALUES (?, ?, ?, ?,?)', [`Multicurrency Account - ${request.toCurrency}`, request.toCurrency, AccountType.Internal, 0.0, request.userId ])
      let newAccount_arr = await query('SELECT * from account where id = ?', [accountId.insertId])
      let newAccount = newAccount_arr[0]
      if (newAccount) {
        const exReqData = new exReq(request.userId, request.bidRate, request.amountPay, request.amountWant, request.fromCurrency, request.toCurrency)
       await executeExchange(request.currentRate, request, userAccount, newAccount, exReqData, request)
      }
    }
  }
}
})
}

// server.express.get('/test_raw_sql', asyncRoute(async (req, res) => {
//   let requesterUser1_arr = await query('SELECT * from user where id = ?', [10000])
//   console.log(requesterUser1_arr)
//   console.log("access null arr" ,requesterUser1_arr[0])
//   res.send().status(200)
// }))

setInterval(findMatch, 3000) //increase time help the performance, but wait long time to recieve transaciton

server.express.post(
  '/confirm-request',
  asyncRoute(async (req, res) => {
    //handle request
    console.log('POST /confirm-request')
    const { amountWant, amountPay, bidRate, currentRate, fromCurrency, toCurrency } = req.body
    console.log(currentRate)
    const authToken = req.cookies.authToken
    //let paid = false;
    if (authToken) {
      //console.log(authToken)
      //const sql = await getSQLConnection()
      //const session = await Session.findOne({ where: { authToken }, relations: ['user'] })
      const session_arr = await query('SELECT * from session left join user on session.userId = user.id where session.authToken = ?', [authToken])
      //console.log(session_str[0].authToken)
      const session = session_arr[0]
      if (session) {
        const exReqData = new exReq(session.userId, bidRate, amountPay, amountWant, fromCurrency, toCurrency)
        //get requester info
        //get requester account
        await transaction(async () => {
          let requesterUser1_arr = await query('SELECT * from user where id = ?', [exReqData.userId])
          let requesterUser1 = requesterUser1_arr[0]

          if (requesterUser1) {
            let userAccount_arr = await query('SELECT * from account left join user on user.id = account.userId where account.userId = ? and account.country = ? and account.type = ?',
             [requesterUser1?.id,exReqData.fromCurrency,AccountType.Internal])
             let userAccount = userAccount_arr[0]

            if (userAccount) {
              if (Number(userAccount.balance) - Number(exReqData.amountPay) >= 0) {
                //check if userToAccount exists
                //substract from account
                res.setHeader('Content-Type', 'application/json')
                res.status(200).send(JSON.stringify({ success: 1, notEnoughMoney: 0, noAccount: 0 }))
                userAccount.balance = Number(userAccount.balance) - Number(exReqData.amountPay)
                await query('update account set account.balance = ? where account.userId = ? and account.country = ?',[userAccount.balance, userAccount.userId, userAccount.country])

                //this is where insert the exchange request from user
                await query('INSERT INTO exchange_request (exchange_request.amountWant, exchange_request.amountPay, exchange_request.bidRate,exchange_request.currentRate, exchange_request.fromCurrency, exchange_request.toCurrency, exchange_request.userId, exchange_request.check) VALUES(?,?,?,?,?,?,?,?)',
                 [exReqData.amountWant,exReqData.amountPay,exReqData.bidRate,currentRate,exReqData.fromCurrency,exReqData.toCurrency,requesterUser1.id,false])

                } else {
                res.setHeader('Content-Type', 'application/json')
                res.status(200).send(JSON.stringify({ success: 0, notEnoughMoney: 1, noAccount: 0 }))
              }
            } else {
              res.setHeader('Content-Type', 'application/json')
              res.status(200).send(JSON.stringify({ success: 0, notEnoughMoney: 0, noAccount: 1 }))
            }
         }
        })
      } else {
        //session not found, login
        res.redirect('/app/login')
      }
    } else {
      //not token found, login
      res.redirect('/app/login')
    }
  })
)

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

server.express.get('/requests', async (req: any, res) => {
  const authToken = req.cookies.authToken || req.header('x-authtoken')
  if (authToken) {
    const session = await Session.findOne({ where: { authToken }, relations: ['user'] })
    if (session) {
      const clientUser = session.user
      const requests = await ExchangeRequest.find({ where: { user: clientUser } })
      res.status(200).type('json').send(requests)
    }
  }
})

/*
 * Links an external bank institution with Plaid,
 */
server.express.post('/getExternalAccounts', async (req, res) => {
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
        // Save the access token for future use
        const user = session.user
        await user.save()
        const { accounts } = await plaidClient.getAccounts(accessToken)
        return res.status(200).send(accounts)
      }
    }
  } catch (e) {
    return res.status(500).send({ error: e.message })
  }
  return res.sendStatus(200)
})

/**
 * Creates internal multicurrency and external accounts given accounts from a bank institution
 */
server.express.post('/createAccounts', async (req, res) => {
  const externalAccounts = req.body.accounts
  const authToken = req.cookies.authToken || req.header('x-authtoken')
  if (authToken) {
    const session = await Session.findOne({ where: { authToken }, relations: ['user'] })
    if (session) {
      const newAccountIds = []
      const user = session.user
      for (const externalAccount of externalAccounts) {
        if (externalAccount.subtype === 'savings' || externalAccount.subtype == 'checking') {
          const { current: accountBalance, iso_currency_code: accountCurrencyCode } = externalAccount.balances
          const externalAccountName = `${externalAccount.name} - ${accountCurrencyCode}`
          const externalAccountExists = (
            await query(
              `SELECT id FROM account
                WHERE account.userId = ${user.id} and
                account.country = '${accountCurrencyCode}' and
                account.name = '${externalAccountName}' and
                account.type = '${AccountType.External}'`
            )
          ).length

          if (!externalAccountExists) {
            const insertResponse = await Account.insert({
              name: `${externalAccountName}`,
              country: accountCurrencyCode,
              balance: accountBalance,
              user,
              type: AccountType.External,
            })
            newAccountIds.push(insertResponse.identifiers[0].id)

            const internalAccountExists = (
              await query(
                `SELECT id FROM account
                  WHERE account.userId = ${user.id} and
                  account.country = '${accountCurrencyCode}' and
                  account.type = '${AccountType.Internal}'`
              )
            ).length

            if (!internalAccountExists) {
              const insertResponse = await Account.insert({
                country: accountCurrencyCode,
                name: `Multicurrency Account - ${accountCurrencyCode}`,
                balance: 0,
                user,
                type: AccountType.Internal,
              })
              newAccountIds.push(insertResponse.identifiers[0].id)
            }
          }
        }
      }
      return res.status(200).send({ newAccountIds })
    }
  }
  return res.status(500).send({ error: 'Could not add the linked accounts!' })
})

server.express.post('/transferBalance', async (req, res) => {
  const { fromAccountId, toAccountId, amount } = req.body
  await transaction(async () => {
    const fromAccount = await Account.findOne({ where: { id: fromAccountId } })
    if (!fromAccount) {
      return res.status(400).send({ error: 'The account to transfer funds from does not exist!' })
    }
    const toAccount = await Account.findOne({ where: { id: toAccountId } })
    if (!toAccount) {
      return res.status(400).send({ error: 'The account to transfer funds to does not exist!' })
    }
    if (fromAccount.balance < amount) {
      return res.status(400).send({ error: 'Insufficient funds!' })
    }

    fromAccount.balance = +fromAccount.balance - +amount
    await fromAccount.save()
    toAccount.balance = +toAccount.balance + +amount
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
