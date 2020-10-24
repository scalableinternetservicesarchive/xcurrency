import { RouteComponentProps } from '@reach/router';
import * as React from 'react';
import { useState } from 'react';
import { Button } from '../../style/button';
import { H1 } from '../../style/header';
import { Input } from '../../style/input';
import { Spacer } from '../../style/spacer';
import { AppRouteParams } from '../nav/route';
import { Page } from './Page';

interface ExchangeFormProps extends RouteComponentProps, AppRouteParams {}

export function ExchangeForm(props: ExchangeFormProps) {
  return (
    <Page>
      <Exchange />
    </Page>
  )
}

//import { UserContext } from './user

function Exchange() {

  const [amountWant, setAmountWant] = useState(0)
  const [bidRate, setBidRate] = useState(0)
  //const [currentRate, setCurrentRate] = useState(0)
  const [fromCurrency, setfromCurrency] = useState('')
  const [toCurrency, setToCurrency] = useState('')
  const [wantStr, setWantStr] = useState('')
  const [bidStr, setBidStr] = useState('')
  const [amountPay, setAmountPay] = useState(0)
  const [disPlayValue, setDisplayValue] = useState(0)


  function handleSubmit () {
    let value = (1/Number(bidStr)) * Number(wantStr);
    value = Number(value.toPrecision(3))
    setAmountPay(value);
    setAmountWant(Number(wantStr))
    setBidRate(Number(bidStr))
    console.log({bidRate})
    console.log({amountPay})
    console.log({amountWant})
    console.log({fromCurrency})
    console.log({toCurrency})
    setDisplayValue(value);
  }

  return (
    <>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="fromCurrency">
          From currency:
        </label>
        <Input $onChange={setfromCurrency} name="fromCurrency" type="text" />
      </div>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="toCurrency">
          To currency:
        </label>
        <Input $onChange={setToCurrency} name="toCurrency" type="text" />
      </div>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="amountWant">
          Foreign Currency: $
        </label>
        <Input $onChange={setWantStr} name="amountWant" type="number" step="0.01" />
      </div>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="bidRate">
          Bid Rate:
        </label>
        <Input $onChange={setBidStr} name="bidRate" type="number" step="0.01" />
      </div>
      <div className="mt3">
        <Button onClick={handleSubmit}>Get Balance</Button>
      </div>
      <Spacer />
      <div>
        <H1> Total balance: ${disPlayValue} </H1>
      </div>
    </>
  )
}