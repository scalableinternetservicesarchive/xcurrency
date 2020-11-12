import { useQuery } from '@apollo/client'
import { navigate, RouteComponentProps } from '@reach/router'
import * as React from 'react'
import { useContext } from 'react'
import CurrencyInput from 'react-currency-input-field'
import Select from 'react-select'
import { check } from '../../../../common/src/util'
import { FetchAccounts, FetchAccountsVariables, FetchAccounts_user_account } from '../../graphql/query.gen'
import { Button } from '../../style/button'
import { Spacer } from '../../style/spacer'
import { fetchAccounts } from '../accounts/fetchAccounts'
import { UserContext } from '../auth/user'
import { AppRouteParams, getPath, Route } from '../nav/route'
import { toastErr } from '../toast/toast'
import { Page } from './Page'
const getSymbolFromCurrency = require('currency-symbol-map')

interface TransferBalancePageProps extends RouteComponentProps, AppRouteParams {}

export function TransferBalancePage(props: TransferBalancePageProps) {
  return (
    <Page>
      <TransferForm />
    </Page>
  )
}

interface AccountSelectOptions {
  label: string | null
  value: number
}

interface SelectAccountProps {
  userAccounts: FetchAccounts_user_account[]
  fromAccountId?: number
  handleChange: any
  reset?: null | undefined
  isDisabled: boolean
}

function SelectAccount(props: SelectAccountProps) {
  let { userAccounts, fromAccountId, handleChange, isDisabled, reset } = props
  let options: AccountSelectOptions[] = []
  if (userAccounts) {
    const transferFromAccount = userAccounts?.find(account => account.id === fromAccountId)
    options = userAccounts
      .filter(account => {
        return (
          !transferFromAccount ||
          (account.country === transferFromAccount.country && account.id !== transferFromAccount.id)
        )
      })
      .sort((a, b) => {
        if (a.country > b.country) {
          return 1
        }
        if (a.country < b.country) {
          return -1
        }
        return a.name! > b.name! ? 1 : -1
      })
      .map(account => {
        return { value: account.id, label: account.name }
      })
  }

  // Set larger width
  const customStyles = {
    container: (provided: any) => ({
      ...provided,
      width: 300,
    }),
  }
  return (
    <Select styles={customStyles} options={options} onChange={handleChange} isDisabled={isDisabled} value={reset} />
  )
}

function TransferForm() {
  const [fromAccountId, setTransferFromAccountId] = React.useState(-1)
  const [toAccountId, setTransferToAccountId] = React.useState(-1)
  const [amount, setAmount] = React.useState('')
  const [currencySymbol, setCurrencySymbol] = React.useState('')
  const [reset, setReset] = React.useState(false)

  async function transfer() {
    if (fromAccountId === -1) {
      toastErr('Please specify an account to transfer funds out of!')
      return
    }

    if (toAccountId === -1) {
      toastErr('Please specify an account to transfer funds into!')
      return
    }

    const amountToTransfer = parseFloat(amount)
    if (amountToTransfer <= 0) {
      toastErr('The amount to transfer must greater than 0!')
      return
    }
    fetch('/transferBalance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromAccountId, toAccountId, amount: amountToTransfer }),
    })
      .then(async res => {
        check(res.status === 200)
        alert('Transfer successful!')
        navigate(getPath(Route.PROFILE))
        window.location.reload()
      })
      .catch(err => {
        toastErr('Cannot process transfer due to insufficient funds!')
      })
  }

  function handleTransferFrom(userAccounts: FetchAccounts_user_account[], accountId: number) {
    setTransferFromAccountId(accountId)

    const transferFromAccount = userAccounts.find(account => account.id === accountId)
    setCurrencySymbol(getSymbolFromCurrency(transferFromAccount?.country!))

    // Reset the transfer to field
    setTransferToAccountId(-1)
    setReset(true)
  }

  function handleTransferTo(selectedOption?: AccountSelectOptions | null) {
    setReset(false)
    setTransferToAccountId(selectedOption!.value)
  }

  function handleAmountChange(value: string | undefined) {
    if (value) {
      setAmount(value)
    }
  }

  const user = useContext(UserContext).user
  const { loading, data } = useQuery<FetchAccounts, FetchAccountsVariables>(fetchAccounts, {
    variables: { id: user!.id },
  })

  if (loading) {
    return <div>loading...</div>
  }

  const userAccounts = data?.user?.account!

  return (
    <>
      <div>
        <label className="db fw4 lh-copy f6">Transfer From</label>
        {userAccounts && (
          <SelectAccount
            handleChange={(selectedOption?: AccountSelectOptions | null) =>
              handleTransferFrom(userAccounts, selectedOption!.value)
            }
            isDisabled={false}
            userAccounts={userAccounts}
          />
        )}
      </div>
      <Spacer $h4 />
      <div>
        <label className="db fw4 lh-copy f6">Transfer To</label>
        {userAccounts && (
          <SelectAccount
            userAccounts={userAccounts}
            handleChange={handleTransferTo}
            fromAccountId={fromAccountId}
            isDisabled={fromAccountId === -1}
            reset={reset ? null : undefined}
          />
        )}
        <Spacer $h2 />
        <label className="db fw4 lh-copy f6">Amount:</label>
        <CurrencyInput
          style={{ border: '1px solid hsl(0,0%,80%)', width: '100%', padding: '0.5rem' }}
          onChange={handleAmountChange}
          allowNegativeValue={false}
          placeholder={currencySymbol + '0.00'}
          prefix={currencySymbol}
        />
      </div>
      <Spacer $h2 />
      <div className="mt3">
        <Button onClick={async () => await transfer()}>Transfer</Button>
      </div>
    </>
  )
}
