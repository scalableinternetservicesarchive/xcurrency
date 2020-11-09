import { ApolloClient, gql } from '@apollo/client'
import { AccountInput, ModifyAccountBalance, ModifyAccountBalanceVariables } from '../../graphql/query.gen'

const mutateAccountBalance = gql`
  mutation ModifyAccountBalance($input: AccountInput!) {
    updateBalance(input: $input)
  }
`
export function modifyAccountBalance(client: ApolloClient<any>, input: AccountInput) {
  return client.mutate<ModifyAccountBalance, ModifyAccountBalanceVariables>({
    mutation: mutateAccountBalance,
    variables: { input },
  })
}
