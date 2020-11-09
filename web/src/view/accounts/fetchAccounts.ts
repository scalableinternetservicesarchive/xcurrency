import { gql } from '@apollo/client'

export const fetchAccounts = gql`
  query FetchAccounts($id: Int!) {
    user(id: $id) {
      account {
        accountId
        name
        balance
        country
      }
    }
  }
`

export const fetchAccount = gql`
  query FetchAccount($accountId: Int!) {
    account(accountId: $accountId) {
      name
    }
  }
`
