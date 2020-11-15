import { useQuery } from '@apollo/client'
import { RouteComponentProps } from '@reach/router'
import * as React from 'react'
import { FetchExchangeRequests, FetchExchangeRequestsVariables } from '../../graphql/query.gen'
import { UserContext } from '../auth/user'
import { fetchExchangeRequests } from '../exchangeRequestQL/fetchExchangeRequest'
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
var id = user.displayId()
    const { loading, data } = useQuery<FetchExchangeRequests, FetchExchangeRequestsVariables>(fetchExchangeRequests, {
    variables: { id },})

    if (loading) {
    return <div>loading...</div>
    }
    if (!data || data.exchangeRequests?.length===0) {
    return <div>no surveys</div>
    }

    return (
    <div className="mw6">
      {data.exchangeRequests?.map(r => (
        <div key={r?.requestId} className="pa3 br2 mb2 bg-black-10 flex items-center">
            Amount Paid: {r?.amountPay} {r?.fromCurrency}, Amount Wanted: {r?.amountWant} {r?.toCurrency}, Bid Rate:
            {r?.bidRate}
            <br></br>
            <br></br>
        </div>
      ))}
    </div>
    )

 /* return (
    <div>
      <br></br>
      <br></br>
      {requests.reverse().map(r => (
        <div key={r.requestId}>
          Amount Paid: {r.amountPay} {r.fromCurrency}, Amount Wanted: {r.amountWant} {r.toCurrency}, Bid Rate:
          {r.bidRate}
          <br></br>
          <br></br>
        </div>
      ))}
    </div>
  ) */
}
