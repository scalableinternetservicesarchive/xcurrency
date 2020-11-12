import { RouteComponentProps } from '@reach/router'
import * as React from 'react'
import { ExchangeRequest } from '../../../../server/src/entities/ExchangeRequest'
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
  const [requests, setRequests] = React.useState([] as ExchangeRequest[])

  fetch('/requests')
    .then(response => response.json())
    .then(json => setRequests(json))
    .catch(err => {
      console.error(err)
    })

  return (
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
  )
}
