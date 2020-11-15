import { gql } from '@apollo/client'
import { ExchangeRequestInput } from '../../../../server/src/graphql/schema.types'
import { getApolloClient } from '../../graphql/apolloClient'
import { CreateRequest, CreateRequestVariables } from '../../graphql/query.gen'

const mutateCreateRequest = gql`
  mutation CreateRequest($input: ExchangeRequestInput!) {
    createRequest(input: $input)
  }
`

export function createRequest(input: ExchangeRequestInput ) {
  return getApolloClient().mutate<CreateRequest, CreateRequestVariables>({
    mutation: mutateCreateRequest,
    variables: { input },
  })
}