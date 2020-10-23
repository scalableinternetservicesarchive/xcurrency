import * as React from 'react';
import { useState } from 'react';
import { Button } from '../../style/button';
import { H1 } from '../../style/header';
import { Input } from '../../style/input';
import { Spacer } from '../../style/spacer';
//import { UserContext } from './user

export function ExchangeForm() {

  const [amountWant, setAmountWant] = useState(0)
  const [bidRate, setBidRate] = useState(0)
  const [currentRate, setCurrentRate] = useState(0)
  const [fromCurrency, setfromCurrency] = useState('')
  const [toCurrency, setToCurrency] = useState('')
  const [amouuntPay, setAmountPay] = useState(0)
  const [disPlayValue, setDisplayValue] = useState(0)


  function handleSubmit () {
    let value = (1/bidRate) * amountWant;
    setAmountPay(value);
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
        <Input $onChange={setAmountWant} name="amountWant" type="number" step="0.01" />
      </div>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="bidRate">
          Bid Rate:
        </label>
        <Input $onChange={setBidRate} name="bidRate" type="number" step="0.01" />
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

export default ExchangeForm;