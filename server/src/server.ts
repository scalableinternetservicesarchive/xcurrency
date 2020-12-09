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
import Redis from 'ioredis'
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
import { TransactionRecord } from './entities/TransactionRecord'
import { User } from './entities/User'
import { checkForMatch, exReq } from './exchangeAlgorithm'
import { getSchema, graphqlRoot, pubsub } from './graphql/api'
import { ConnectionManager } from './graphql/ConnectionManager'
import { AccountType, UserType } from './graphql/schema.types'
import { expressLambdaProxy } from './lambda/handler'
import { renderApp } from './render'

const redis = new Redis();

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
    const user = await query(`
      SELECT * FROM user WHERE email='${email}'
    `)

    if (!user.length || !(await bcrypt.compare(password, user[0].password))) {
      res.status(403).send('Forbidden')
      return
    }

    const authToken = uuidv4()

    await query(`DELETE FROM session WHERE userId='${user[0].id}'`)
    await query(`INSERT INTO session (authToken, userId) VALUES('${authToken}', '${user[0].id}')`)
    // const session = new Session()
    // session.authToken = authToken
    // session.userId = user[0].id
    // await Session.save(session).then(s => console.log('saved session ' + s.id))

    // Cache the session upon login
    await redis.set(authToken, JSON.stringify(user[0]))

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
    console.log('POST /auth/signup');
    const { name, email, password } = req.body
    const user = await query(`
      SELECT * FROM user WHERE email='${email}'
    `)

    if (user.length) {
      console.log('Already found user in the database!')
      return res.sendStatus(400)
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    await query(`
      INSERT INTO user (name, email, password) VALUES ('${name}', '${email}', '${hashedPassword}')
    `)

    console.log('Inserted user into database!')
    return res.status(200).send('Success!')
  })
)

/*
function existAccount(user : User, country : string){
  for (let i = 0; i < user.account.length; i++) {
    if (user.account[i].country == country) {
        //have account
        return i
    }
  }
  return -1
}
*/

async function executeExchange(
  currentRate: number,
  requesterUser: User,
  userAccount: Account,
  userToAccount: Account,
  exReqData: exReq
) {
  //store this request into ExchangeRequest table
  /*await transaction( async () => {

  })*/
    const requestId = await ExchangeRequest.insert({
      amountWant: exReqData.amountWant,
      amountPay: exReqData.amountPay,
      bidRate: exReqData.bidRate,
      currentRate: currentRate,
      fromCurrency: exReqData.fromCurrency,
      toCurrency: exReqData.toCurrency,
      user: requesterUser,
    })
    //get the request
    let thisRequest = await ExchangeRequest.findOne({ where: { requestId: requestId.generatedMaps[0].requestId } })
    if (thisRequest) {
      const requestbidrate = 1 / exReqData.bidRate
      const exchangeRequests = await ExchangeRequest.createQueryBuilder('exchange_request')
        .leftJoinAndSelect('exchange_request.user', 'user')
        .where('fromCurrency = :requestToCountry', { requestToCountry: exReqData.toCurrency })
        .andWhere('toCurrency = :requestFromCurrency', { requestFromCurrency: exReqData.fromCurrency })
        .andWhere('bidRate <= :requestBidRate', { requestBidRate: requestbidrate })
        .andWhere('amountPay <= :discrepency', {
          discrepency: Number(Number(moneyDeviationPara.get(exReqData.toCurrency)) + Number(exReqData.amountWant)),
        })
        .andWhere('amountPay >= :discrepency1', {
          discrepency1: Number(Number(exReqData.amountWant) - Number(moneyDeviationPara.get(exReqData.toCurrency))),
        })
        .andWhere('amountWant <= :discrepency2', {
          discrepency2: Number(Number(moneyDeviationPara.get(exReqData.fromCurrency)) + Number(exReqData.amountPay)),
        })
        .andWhere('amountWant >= :discrepency3', {
          discrepency3: Number(Number(exReqData.amountPay) - Number(moneyDeviationPara.get(exReqData.fromCurrency))),
        })
        .getMany()
      const match = await checkForMatch(exReqData, exchangeRequests)
      if (match[0]) {
        //update admin account
        let adminUser = await User.findOne({ where: { userType: UserType.Admin } })
        let adminToAccount = await Account.findOne({
          where: { user: adminUser, country: exReqData.toCurrency, type: AccountType.Internal },
        })
        let adminFromAccount = await Account.findOne({
          where: { user: adminUser, country: exReqData.fromCurrency, type: AccountType.Internal },
        })
        let exReq2 = await ExchangeRequest.findOne({ where: { requestId: match[0] } })
        let secondUser = await User.createQueryBuilder('user')
          .leftJoinAndSelect('user.exchangeRequest', 'exchange_request')
          .where(' exchange_request.requestId = :exId ', { exId: match[0] })
          .getOne()
        let secondUserFromAccount = await Account.createQueryBuilder('account')
          .leftJoinAndSelect('account.user', 'user')
          .where(' user.id = :uId', { uId: secondUser?.id })
          .andWhere(' country = :fromCountry ', { fromCountry: exReq2?.fromCurrency })
          .andWhere('type = :accountType', { accountType: AccountType.Internal })
          .getOne()
        let secondUserToAccount = await Account.createQueryBuilder('account')
          .leftJoinAndSelect('account.user', 'user')
          .where(' user.id = :uId', { uId: secondUser?.id })
          .andWhere(' country = :toCountry ', { toCountry: exReq2?.toCurrency })
          .andWhere('type = :accountType', { accountType: AccountType.Internal })
          .getOne()
        if (adminToAccount) {
          if (adminFromAccount) {
            if (exReq2) {
              if (secondUser) {
                if (secondUserFromAccount) {
                  if (secondUserToAccount) {
                    //update admin account
                    adminFromAccount.balance =
                      Number(adminFromAccount.balance) + Number(exReqData.amountPay) - Number(exReq2.amountWant)
                    adminToAccount.balance =
                      Number(adminToAccount.balance) - Number(exReqData.amountWant) + Number(exReq2.amountPay)
                    //update user1 (requester) account
                    userToAccount.balance = Number(userToAccount.balance) + Number(exReqData.amountWant)
                    //update user2 account
                    secondUserFromAccount.balance = Number(secondUserFromAccount.balance) - Number(exReq2.amountPay)
                    secondUserToAccount.balance = Number(secondUserToAccount.balance) + Number(exReq2.amountWant)
                    await Account.save(userAccount)
                    await Account.save(userToAccount)
                    await Account.save(secondUserFromAccount)
                    await Account.save(secondUserToAccount)
                    await Account.save(adminFromAccount)
                    await Account.save(adminToAccount)
                    //store transaction in transaction history
                    await TransactionRecord.insert({
                      user1Id: requesterUser.id,
                      user2Id: secondUser.id,
                      requestId1: thisRequest.requestId,
                      requestId2: exReq2.requestId,
                    })
                    //delete requests
                    await ExchangeRequest.createQueryBuilder()
                      .delete()
                      .from(ExchangeRequest)
                      .where({ requestId: thisRequest.requestId })
                      .execute()
                    await ExchangeRequest.createQueryBuilder()
                      .delete()
                      .from(ExchangeRequest)
                      .where({ requestId: exReq2.requestId })
                      .execute()
                  }
                }
              }
            }
          }
        }
      }
    }
} /*
// test exchange request functionality
server.express.get('/test-exchange', asyncRoute(async (req, res) => {
  //seed fake requests
  console.log("hello world!")
  let user2 = await createTempUser('sokchetraeung@gmail.com', 'sokchetraeung', 'USD', 100.0);
  let user2Account = await createTempAccount(user2,100.0)
  let user1 = await createTempUser('evanlin@gmail.com', 'evanlin','CAD',100.0);
  let user1Account = await createTempAccount(user1,100.0)

    if (user1) {
      if (user2) {
      if (user1Account) {
      if (user2Account) {
        const exReqdata2 = new exReq(user1.id, 1.30, 7.69 ,10.0, 'USD','CAD' );
        const exReqdata1 = new exReq(user2.id, 0.7, 14.28 ,10.0, 'CAD', 'USD');
        let request1 = await createTempRequest(user1,exReqdata1)
        let request2 = await createTempRequest(user2,exReqdata2)
        console.log(request2)
        const match = await checkForMatch(exReqdata1)
        console.log(match)
        if (match[0]) {
          //there is a match
          //update requester account assume user1 is the requester
          user1Account[0].balance = user1Account[0].balance - exReqdata1.amountPay
          let userToAccount = await Account.createQueryBuilder("account")
                                           .leftJoinAndSelect("account.user", "user")
                                          .where("user.id = :uId" , { uId : exReqdata1.userId } )
                                          .andWhere("country = :toCurrency", { toCurrency : exReqdata1.toCurrency } )
                                          .getOne()
          if (userToAccount){
            userToAccount.balance = userToAccount.balance + exReqdata1.amountWant
          }
          else {
            //no userToAccount, create a new account to store desire money
            const accountId = await Account.createQueryBuilder().insert().into(Account).values({ country: exReqdata1.toCurrency, type: 'interal', balance: exReqdata1.amountWant, user: user1}).returning('id').execute()
            const newAccount = await Account.findOne({ where : {accountId : accountId  } })
            if (newAccount) {
              user1.account.push(newAccount) //successfuly created the account
            }
          }
          //update the second user's accounts
          let exReq2 = await ExchangeRequest.findOne({ where : { requestId : match[0] } })
          if (exReq2) {
            let secondUser = await User.createQueryBuilder("user")
                                       .leftJoinAndSelect("user.exchangeRequest", "exchange_request")
                                       .where(" exchange_request.requestId = :exId ", { exId : match[0] } )
                                       .getOne()
            let secondUserFromAccount = await Account.createQueryBuilder("account")
                                                     .leftJoinAndSelect("account.user", "user")
                                                     .where(" user.id = :uId" , { uId : secondUser?.id } )
                                                     .andWhere(" country = :fromCountry ", { fromCountry : exReq2.fromCurrency })
                                                     .getOne()
            if (secondUserFromAccount) {
              secondUserFromAccount.balance = secondUserFromAccount.balance - exReq2.amountPay
            }
            let secondUserToAccount = await Account.createQueryBuilder("account")
                                                   .leftJoinAndSelect("account.user", "user")
                                                   .where(" user.id = :uId" , { uId : secondUser?.id } )
                                                   .andWhere(" country = :toCountry ", { toCountry : exReq2.toCurrency } )
                                                   .getOne()
            if (secondUserToAccount) {
              secondUserToAccount.balance = secondUserToAccount.balance + exReq2.amountWant
            }
            //store transaction in transaction history
            TransactionRecord.createQueryBuilder().insert().into(TransactionRecord).values({
                    requestId1 : request1?.requestId,
                    requestId2 : exReq2.requestId,
                    profit: match[1]
                  }).execute()
          }
        }

      }
      }

      }
      }
} ))
*/ /*
async function createTempUser(email : string, name : string, country : string, balance : number ) {
const user = await User.insert({ email : email, userType :  UserType.User, name : name, password: 'sokchetraeung',
country : country, exchangeRequest : [] , account : [] })
let user1 = await User.findOne({ where : { id : user.generatedMaps[0].id } })
return user1;
}


async function createTempAccount(user : User | undefined, balance : number ) {
  if (user) {
  let user1 = await User.findOne({ where : { id : user.id} })
  let tempArr :Account[] = []
  const country :string[] = ['USD', 'CAD', 'JPY', 'BRL', 'INR', 'CNY']
  for (let i = 0; i < 6; i++){
    await Account.createQueryBuilder().insert().into(Account).values({ country: country[i], type: 'interal', balance: balance, user : user1 }).execute()
    let user1Account = await Account.createQueryBuilder("account")
                                    .leftJoinAndSelect("account.user", "user")
                                    .where("user.id = :uId" , { uId : user.id } )
                                    .andWhere("country = :userCountry", { userCountry : country[i] } )
                                    .getOne()
    tempArr.push(user1Account!)
  }
  if (user1) {
        user1.account = tempArr;
  }
  return tempArr;
  }
  return null
}

async function createTempRequest(user : User, exReqData : exReq) {
/*
  //await transaction(async entityManager => {
    await ExchangeRequest.createQueryBuilder().insert().into(ExchangeRequest).values( { amountWant: exReqData.amountWant, amountPay: exReqData.amountPay, bidRate: exReqData.bidRate
      , currentRate: 1, fromCurrency: exReqData.fromCurrency, toCurrency: exReqData.toCurrency, user: user } ).execute()
    const requestId = await query(` SELECT LAST_INSERT_ID()`);
    console.log(requestId)
  //});
  */

/*
let exch = await ExchangeRequest.insert({ amountWant: exReqData.amountWant, amountPay: exReqData.amountPay, bidRate: exReqData.bidRate
  , currentRate: 1, fromCurrency: exReqData.fromCurrency, toCurrency: exReqData.toCurrency, user: user })
  const myRequest = await ExchangeRequest.findOne({ where : { requestId : exch.generatedMaps[0].requestId } })
  if (myRequest) {
    return myRequest
  }
  return null
}
*/ server.express.post(
  '/confirm-request',
  asyncRoute(async (req, res) => {
    //handle request
    console.log('POST /confirm-request')
    const { amountWant, amountPay, bidRate, currentRate, fromCurrency, toCurrency } = req.body
    console.log(currentRate)
    let paid = false;
    const user = await getLoggedInUser(req);
    const exReqData = new exReq(user.id, bidRate, amountPay, amountWant, fromCurrency, toCurrency)
    //get requester info
    //get requester account
    await transaction(async () => {
      let requesterUser = await User.findOne({ where: { id: exReqData.userId } })
      //console.log(requesterUser)
      if (requesterUser) {
        let userAccount = await Account.createQueryBuilder('account')
          .leftJoinAndSelect('account.user', 'user')
          .where('user.id = :uId ', { uId: requesterUser.id })
          .andWhere('country = :fromCurrency', { fromCurrency: exReqData.fromCurrency })
          .andWhere('type = :accountType', { accountType: AccountType.Internal })
          .getOne()
        if (userAccount) {
          if (Number(userAccount.balance) - Number(exReqData.amountPay) >= 0) {
            //check if userToAccount exists
            //substract from account
            userAccount.balance = Number(userAccount.balance) - Number(exReqData.amountPay)
            Account.save(userAccount)
            paid = true;
            res.setHeader('Content-Type', 'application/json')
            res.status(200).send(JSON.stringify({ success: 1, notEnoughMoney: 0, noAccount: 0 }))
          } else {
            res.setHeader('Content-Type', 'application/json')
            res.status(200).send(JSON.stringify({ success: 0, notEnoughMoney: 1, noAccount: 0 }))
          }
        } else {
          console.log(exReqData)
          res.setHeader('Content-Type', 'application/json')
          res.status(200).send(JSON.stringify({ success: 0, notEnoughMoney: 0, noAccount: 1 }))
        }
      }
    })
    // check for match and perform transaction
    await transaction(async () => {
      let requesterUser = await User.findOne({ where: { id: exReqData.userId } })
      if (requesterUser && paid) {
        let userAccount = await Account.createQueryBuilder('account')
          .leftJoinAndSelect('account.user', 'user')
          .where('user.id = :uId ', { uId: requesterUser.id })
          .andWhere('country = :fromCurrency', { fromCurrency: exReqData.fromCurrency })
          .andWhere('type = :accountType', { accountType: AccountType.Internal })
          .getOne()
        if (userAccount) {
          let userToAccount = await Account.createQueryBuilder('account')
            .leftJoinAndSelect('account.user', 'user')
            .where('user.id = :uId', { uId: exReqData.userId })
            .andWhere('country = :toCurrency', { toCurrency: exReqData.toCurrency })
            .andWhere('type = :accountType', { accountType: AccountType.Internal })
            .getOne()
          if (userToAccount) {
            await executeExchange(currentRate, requesterUser, userAccount, userToAccount, exReqData)
          } else {
            //no userToAccount, create a new account to store desire money
            const accountId = await Account.insert({
              name: `Multicurrency Account - ${exReqData.toCurrency}`,
              country: exReqData.toCurrency,
              type: AccountType.Internal,
              balance: 0.0,
              user: requesterUser,
            })
            let newAccount = await Account.findOne({ where: { id: accountId.generatedMaps[0].id } })
            if (newAccount) {
              await executeExchange(currentRate, requesterUser, userAccount, newAccount, exReqData)
            }
          }
        }
      }
    })
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
    await redis.del(authToken)
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
    setReqUser(req, await getLoggedInUser(req));
    next()
  })
)

function setReqUser(req: any, user: any) {
  req.user = user;
}

async function getLoggedInUser(req: any) {
  const authToken = req.cookies.authToken || req.header('x-authtoken');
  if (authToken) {
    const redisResponse = await redis.get(authToken);
    if (redisResponse) {
      return JSON.parse(redisResponse)
    }
    else {
      const session = await Session.findOne({ where: { authToken }, relations: ['user'] })
      if (session) {
        await redis.set(authToken, JSON.stringify(session.user))
        return session.user;
      }
    }
  }
}

server.express.post('/getPlaidLinkToken', async (req: any, res) => {
  const user = await getLoggedInUser(req);
  try {
    const tokenResponse = await plaidClient.createLinkToken({
      user: {
        client_user_id: String(user.id),
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
})

server.express.get('/requests', async (req: any, res) => {
  const user = await getLoggedInUser(req);
  const requests = await ExchangeRequest.find({ where: { user } })
  res.status(200).type('json').send(requests)
})

/*
 * Links an external bank institution with Plaid,
 */
server.express.post('/getExternalAccounts', async (req, res) => {
  try {
    const publicToken = req.body.public_token
    // Exchange the client-side public_token for a server access_token
    const tokenResponse = await plaidClient.exchangePublicToken(publicToken)
    const { accounts } = await plaidClient.getAccounts(tokenResponse.access_token)
    return res.status(200).send(accounts)
  } catch (e) {
    return res.status(500).send({ error: e.message })
  }
})

/**
 * Creates internal multicurrency and external accounts given accounts from a bank institution
 */
server.express.post('/createAccounts', async (req, res) => {
  const externalAccounts = req.body.accounts
  const user = await getLoggedInUser(req);
  let newAccounts: any[] = [];
  for (const externalAccount of externalAccounts) {
    if (externalAccount.subtype === 'savings' || externalAccount.subtype == 'checking') {
      const { current: accountBalance, iso_currency_code: accountCurrencyCode } = externalAccount.balances
      const externalAccountName = `${externalAccount.name} - ${accountCurrencyCode}`
      const [externalAccountExists, internalAccountExists] = await Promise.all([query(
        `SELECT id FROM account
            WHERE account.userId = ${user.id} and
            account.country = '${accountCurrencyCode}' and
            account.name = '${externalAccountName}' and
            account.type = '${AccountType.External}'`
      ), query(
        `SELECT id FROM account
          WHERE account.userId = ${user.id} and
          account.country = '${accountCurrencyCode}' and
          account.type = '${AccountType.Internal}'`
      )]);

      const insertAccountPromises = []
      if (!externalAccountExists.length) {
        insertAccountPromises.push(
          query(`
            INSERT INTO account (name, country, userId, balance, type) VALUES ('${externalAccountName}',
            '${accountCurrencyCode}', '${user.id}', '${accountBalance}', '${AccountType.External}')
          `)
        )
        const externalAccount = (await query(`
          SELECT * FROM account JOIN users on users.id=account.userId
          WHERE userId='${user.id}' and name='${externalAccountName}'`
        ))[0];
        pubsub.publish('ACCOUNT_UPDATE_' + externalAccount.userId, externalAccount)

        if (!internalAccountExists.length) {
          const internalAccountName = `Multicurrency Account - ${accountCurrencyCode}`;
          insertAccountPromises.push(
            query(`
              INSERT INTO account (name, country, userId, balance, type) VALUES ('${internalAccountName}',
              '${accountCurrencyCode}', '${user.id}', '0', '${AccountType.Internal}')`
            )
          )

          const internalAccount = (await query(`
            SELECT * FROM account JOIN users on users.id=account.userId
            WHERE userId='${user.id}' and name='${internalAccountName}'`
          ))[0];
          pubsub.publish('ACCOUNT_UPDATE_' + internalAccount.userId, internalAccount)
        }
      }
      newAccounts.push(...(await Promise.all(insertAccountPromises)))
    }
  }
  return res.status(200).send({newAccounts})
})

server.express.post('/transferBalance', async (req, res) => {
  const { fromAccountId, toAccountId, amount } = req.body
  await transaction(async () => {
    const [fromAccount, toAccount] = await Promise.all([
      query(`SELECT id, balance FROM account WHERE id='${fromAccountId}'`),
      query(`SELECT id, balance FROM account WHERE id='${toAccountId}'`),
    ])

    if (!fromAccount.length) {
      return res.status(400).send({ error: 'The account to transfer funds from does not exist!' })
    }
    if (!toAccount.length) {
      return res.status(400).send({ error: 'The account to transfer funds to does not exist!' })
    }

    if (fromAccount[0].balance < amount) {
      return res.status(400).send({ error: 'Insufficient funds!' })
    }

    const fromAccountBalance = +fromAccount[0].balance - +amount
    const toAccountBalance = +toAccount[0].balance + +amount

    await Promise.all([
      query(`UPDATE account SET balance='${fromAccountBalance}' WHERE id='${fromAccount[0].id}'`),
      query(`UPDATE account SET balance='${toAccountBalance}' WHERE id='${toAccount[0].id}'`),
    ])
    pubsub.publish('ACCOUNT_UPDATE_' + toAccount.userId, toAccount)
    pubsub.publish('ACCOUNT_UPDATE_' + fromAccount.userId, fromAccount)

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
