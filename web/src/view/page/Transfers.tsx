import { useQuery, useSubscription } from '@apollo/client'
import { RouteComponentProps } from '@reach/router'
import * as React from 'react'
import {
  FetchExchangeRequests,
  FetchExchangeRequestsVariables,
  RequestSubscription,
  RequestSubscriptionVariables
} from '../../graphql/query.gen'
import { UserContext } from '../auth/user'
import { fetchExchangeRequests, subscribeRequests } from '../exchangeRequestQL/fetchExchangeRequest'
import { AppRouteParams } from '../nav/route'
import { Page } from './Page'
interface TransfersProps extends RouteComponentProps, AppRouteParams {}

export function Transfers(props: TransfersProps) {
  return (
    <Page>
      <MyTransfers />
    </Page>
  )
}

export function MyTransfers() {
  //const [requests, setRequests] = React.useState([] as ExchangeRequest[])
  /*
  fetch('/requests')
    .then(response => response.json())
    .then(json => setRequests(json))
    .catch(err => {
      console.error(err)
    })
*/
  const user = React.useContext(UserContext)
  const id = user.displayId()
  const { loading, data } = useQuery<FetchExchangeRequests, FetchExchangeRequestsVariables>(fetchExchangeRequests, {
    variables: { id },
    // pollInterval: 1000,
  })

  const [requestsUpdates, setRequestsUpdates] = React.useState(data?.exchangeRequests? as any)

  useEffect(() => {
    setRequestsUpdates(data?.exchangeRequests)
  }, [data])

  const sub = useSubscription<RequestSubscription, RequestSubscriptionVariables>(subscribeRequests, {
    variables: { userId: user!.id },
  })

  // update according to subscription
  useEffect(() => {
    console.log(sub.data);
    if (sub.data?.accountUpdates) {
      if (userAccounts) {
        const clonedUserAccounts: any[] = []
        userAccounts.forEach((account: any) =>
          clonedUserAccounts.push({ name: account.name, balance: account.balance })
        )
        let isUpdate = false
        for (let i = 0; i < clonedUserAccounts.length; i++) {
          if (clonedUserAccounts[i]?.name === sub.data?.accountUpdates.name) {
            isUpdate = true
            clonedUserAccounts[i].balance = sub.data?.accountUpdates.balance
          }
        }
        if (!isUpdate) {
          clonedUserAccounts.push({ name: sub.data.accountUpdates.name, balance: sub.data.accountUpdates.balance })
        }
        setUserAccounts(clonedUserAccounts)
      }
    }
  }, [sub.data])

  if (loading) {
    return <div>loading...</div>
  }
  if (!data || data.exchangeRequests?.length === 0 || !requestsUpdates) {
    return <div>No Transfer History</div>
  }

  return (
    <div className="mw6">
      {requestsUpdates
        ?.slice(0)
        .reverse()
        .map(r => (
          <div key={r?.requestId} className="pa3 br2 mb2 bg-black-10 flex items-center">
            Amount Paid: {r?.amountPay} {r?.fromCurrency}, Amount Wanted: {r?.amountWant} {r?.toCurrency}, Bid Rate:
            {r?.bidRate}
            <br></br>
            <br></br>
          </div>
        ))}
    </div>
  )

}
