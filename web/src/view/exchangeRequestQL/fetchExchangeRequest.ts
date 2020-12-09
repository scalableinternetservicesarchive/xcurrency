import { gql } from '@apollo/client'

export const fragmentExchangeRequest = gql`
  fragment ExchangeRequest on ExchangeRequest {
    requestId
    amountWant
    bidRate
    amountPay
    currentRate
    fromCurrency
    toCurrency
  }
`

export const fetchExchangeRequests = gql`
  query FetchExchangeRequests($id: Int) {
    exchangeRequests(id: $id) {
      ...ExchangeRequest
    }
  }
  ${fragmentExchangeRequest} `

export const subscribeRequests = gql`
  subscription RequestSubscription($userId: Int!) {
    requestUpdates(userId: $userId) {
      ...ExchangeRequest
    }
  }
  ${fragmentExchangeRequest}
`
