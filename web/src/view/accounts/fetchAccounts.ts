import { gql } from '@apollo/client'

export const fetchAccounts = gql`
  query FetchAccounts($id: Int!) {
    user(id: $id) {
      account {
        id
        name
        balance
        country
      }
    }
  }
`

export const fetchAccount = gql`
  query FetchAccount($id: Int!) {
    account(id: $id) {
      name
    }
  }
`

export const subscribeAccounts = gql`
  subscription AccountsSubscription($userId: Int!) {
    accountUpdates(userId: $userId) {
      ...Accounts
    }
  }
`
