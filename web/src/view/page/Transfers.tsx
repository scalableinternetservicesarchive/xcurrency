import { useQuery, useSubscription } from '@apollo/client'
import { RouteComponentProps } from '@reach/router'
import * as React from 'react'
import { useEffect } from 'react'
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
  const user1 = React.useContext(UserContext)
  const user = React.useContext(UserContext).user
  const id = user1.displayId()
  const { loading, data } = useQuery<FetchExchangeRequests, FetchExchangeRequestsVariables>(fetchExchangeRequests, {
    variables: { id },
    fetchPolicy: 'network-only',
    // pollInterval: 1000,
  })

  const [requests, setRequests] = React.useState(data?.exchangeRequests)

  useEffect(() => {
    setRequests(data?.exchangeRequests)
  }, [data])

  const sub = useSubscription<RequestSubscription, RequestSubscriptionVariables>(subscribeRequests, {
    variables: { userId: user!.id },
  })

  // update according to subscription
  useEffect(() => {
    console.log(sub.data)
    if (sub.data?.requestUpdates) {
      const clonedRequests: any[] = []
      console.log("requests: ", requests)
      if (requests) {
        requests.forEach((request: any) =>
          clonedRequests.push({
            amountPay: request.amountPay,
            fromCurrency: request.fromCurrency,
            amountWant: request.amountWant,
            toCurrency: request.toCurrency,
            bidRate: request.bidRate,
          })
        )
      }
      const newTransferData = {
        amountPay: sub.data.requestUpdates.amountPay,
        fromCurrency: sub.data.requestUpdates.fromCurrency,
        amountWant: sub.data.requestUpdates.amountWant,
        toCurrency: sub.data.requestUpdates.toCurrency,
        bidRate: sub.data.requestUpdates.bidRate,
      };
      console.log("new transfer data: ", newTransferData)
      clonedRequests.push(newTransferData)
      console.log(clonedRequests)
      setRequests(clonedRequests)
    }
  }, [sub.data])

  if (loading) {
    return <div>loading...</div>
  }
  if ((!data && requests?.length === 0) || (requests?.length === 0 && data?.exchangeRequests?.length === 0)) {
    return <div>No Transfer History</div>
  }
  else {
    console.log(data, requests);
    return (
      <div className="mw6">
        {requests
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
}
