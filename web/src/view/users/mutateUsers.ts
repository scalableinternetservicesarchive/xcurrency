import { gql } from '@apollo/client'
import { UserInput } from '../../../../server/src/graphql/schema.types'
import { getApolloClient } from '../../graphql/apolloClient'
import { CreateUser, CreateUserVariables } from '../../graphql/query.gen'

const mutateCreateUser = gql`
  mutation CreateUser($input: UserInput!) {
    createUser(input: $input)
  }
`

export function createUser(input: UserInput) {
  return getApolloClient().mutate<CreateUser, CreateUserVariables>({
    mutation: mutateCreateUser,
    variables: { input },
  })
}
