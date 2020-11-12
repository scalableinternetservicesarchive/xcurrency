import { ApolloClient, gql } from '@apollo/client'
import { getApolloClient } from '../../graphql/apolloClient'
import {
  AccountInfo,
  AccountInput,
  CreateAccount,
  CreateAccountVariables,
  ModifyAccountBalance,
  ModifyAccountBalanceVariables,
} from '../../graphql/query.gen'

const mutateCreateAccount = gql`
  mutation CreateAccount($input: AccountInfo!) {
    createAccount(input: $input)
  }
`

const mutateAccountBalance = gql`
  mutation ModifyAccountBalance($input: AccountInput!) {
    updateBalance(input: $input)
  }
`

export function createAccount(input: AccountInfo) {
  return getApolloClient().mutate<CreateAccount, CreateAccountVariables>({
    mutation: mutateCreateAccount,
    variables: { input },
  })
}
export function modifyAccountBalance(client: ApolloClient<any>, input: AccountInput) {
  return client.mutate<ModifyAccountBalance, ModifyAccountBalanceVariables>({
    mutation: mutateAccountBalance,
    variables: { input },
  })
}
