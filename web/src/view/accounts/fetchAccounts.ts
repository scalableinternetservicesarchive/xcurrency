import { gql } from '@apollo/client'

export const fetchAccounts = gql`
  query FetchAccounts($id: Int!) {
    user(id: $id) {
      account {
        accountId
        name
        balance
      }
    }
  }
`
