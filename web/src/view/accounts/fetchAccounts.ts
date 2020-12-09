import { gql } from '@apollo/client'


export const fragmentAccount = gql`
  fragment Account on Account {
    user {
      id
    }
    name
    balance
  }
`

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
      ...Account
    }
  }
  ${fragmentAccount}
`

// export const subscribeSurveys = gql`
//   subscription SurveySubscription($surveyId: Int!) {
//     surveyUpdates(surveyId: $surveyId) {
//       ...Survey
//     }
//   }
//   ${fragmentSurvey}
//   ${fragmentSurveyQuestion}
// `
