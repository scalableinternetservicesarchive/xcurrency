import * as bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { PubSub } from 'graphql-yoga'
import path from 'path'
import { check } from '../../../common/src/util'
import { Account } from '../entities/Accounts'
import { ExchangeRequest } from '../entities/ExchangeRequest'
import { Survey } from '../entities/Survey'
import { SurveyAnswer } from '../entities/SurveyAnswer'
import { SurveyQuestion } from '../entities/SurveyQuestion'
import { User } from '../entities/User'
import { Resolvers } from './schema.types'

export const pubsub = new PubSub()

export function getSchema() {
  const schema = readFileSync(path.join(__dirname, 'schema.graphql'))
  return schema.toString()
}

interface Context {
  user: User | null
  request: Request
  response: Response
  pubsub: PubSub
}

export const graphqlRoot: Resolvers<Context> = {
  Query: {
    self: (_, args, ctx) => ctx.user,
    user: async (_, { id }) => {
      const user = await User.findOne({ where: { id }, relations: ['account'] })
      return user || null
    },
    survey: async (_, { surveyId }) => (await Survey.findOne({ where: { id: surveyId } })) || null,
    surveys: () => Survey.find(),
    accounts: () => Account.find(),
    account: async (_, { id }) => {
      const account = await Account.findOne({ where: { id } })
      return account || null
    },
    exchangeRequests: async (_, { id }) => {
      const exchangeRequests = await ExchangeRequest.createQueryBuilder('exchange_request').leftJoinAndSelect('exchange_request.user', 'user')
                                                    .where('user.id = :uId', { uId : id } )
                                                    .getMany()
      return exchangeRequests || null
    },
  },
  Mutation: {
    answerSurvey: async (_, { input }, ctx) => {
      const { answer, questionId } = input
      const question = check(await SurveyQuestion.findOne({ where: { id: questionId }, relations: ['survey'] }))

      const surveyAnswer = new SurveyAnswer()
      surveyAnswer.question = question
      surveyAnswer.answer = answer
      await surveyAnswer.save()

      question.survey.currentQuestion?.answers.push(surveyAnswer)
      ctx.pubsub.publish('SURVEY_UPDATE_' + question.survey.id, question.survey)

      return true
    },
    nextSurveyQuestion: async (_, { surveyId }, ctx) => {
      // check(ctx.user?.userType === UserType.Admin)
      const survey = check(await Survey.findOne({ where: { id: surveyId } }))
      survey.currQuestion = survey.currQuestion == null ? 0 : survey.currQuestion + 1
      await survey.save()
      ctx.pubsub.publish('SURVEY_UPDATE_' + surveyId, survey)
      return survey
    },
    updateBalance: async (_, { input }) => {
      const { id, balance } = input
      const account = check(await Account.findOne({ where: { id } }))
      account.balance = balance
      await account.save()
      return true
    },
    createAccount: async (_, { input }) => {
      const { country, type, balance, name, userId } = input
      await Account.insert({ country, type, balance, name, userId })
      return true
    },
    createUser: async (_, { input }) => {
      const { userType, email, name, password } = input
      const saltRounds = 10
      const hashedPassword = await bcrypt.hash(password, saltRounds)
      const user = await User.insert({ userType, email, name, password: hashedPassword })
      return user.identifiers[0].id
    },
    createRequest: async (_, { input }) => {
      const {amountWant, bidRate, amountPay, currentRate,fromCurrency, toCurrency } = input
      await ExchangeRequest.insert({ amountWant: amountWant, amountPay: amountPay, bidRate: bidRate, currentRate: currentRate,
      fromCurrency: fromCurrency, toCurrency: toCurrency })
      return true
    },
  },
  Subscription: {
    surveyUpdates: {
      subscribe: (_, { surveyId }, context) => context.pubsub.asyncIterator('SURVEY_UPDATE_' + surveyId),
      resolve: (payload: any) => payload,
    },
    requestUpdates: {
      subscribe: (_, { userId }, ctx) => ctx.pubsub.asyncIterator('REQUEST_UPDATE_' + userId),
      resolve: (payload: any) => payload,
    },
    accountUpdates: {
      subscribe: (_, { userId }, ctx) => ctx.pubsub.asyncIterator('ACCOUNT_UPDATE_' + userId),
      resolve: (payload: any) => payload,
    },
  },
}
