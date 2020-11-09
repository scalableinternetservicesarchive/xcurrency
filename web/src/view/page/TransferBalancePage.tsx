import { useQuery } from '@apollo/client'
import { navigate, RouteComponentProps } from '@reach/router'
import * as React from 'react'
import { useContext } from 'react'
import Select from 'react-select'
import { check } from '../../../../common/src/util'
import { FetchAccounts, FetchAccountsVariables, FetchAccounts_user_account } from '../../graphql/query.gen'
import { Button } from '../../style/button'
import { Input } from '../../style/input'
import { Spacer } from '../../style/spacer'
import { fetchAccounts } from '../accounts/fetchAccounts'
import { UserContext } from '../auth/user'
import { AppRouteParams, getPath, Route } from '../nav/route'
import { toastErr } from '../toast/toast'
import { Page } from './Page'

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
  handleChange: any
  userAccounts: FetchAccounts_user_account[]
  fromAccountId?: number
  reset?: null | undefined
  isDisabled: boolean
}

function SelectAccount(props: SelectAccountProps) {
  let { userAccounts, fromAccountId, handleChange, isDisabled, reset } = props
  let options: AccountSelectOptions[] = []
  if (userAccounts) {
    const transferFromAccount = userAccounts?.find(account => account.accountId === fromAccountId)

    options = userAccounts
      .filter(account => {
        return (
          !transferFromAccount ||
          (account.country === transferFromAccount.country && account.accountId !== transferFromAccount.accountId)
        )
      })
      .map(account => {
        return { value: account.accountId, label: account.name }
      })
      .sort((a, b) => (a.label! > b.label! ? 1 : -1))
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
  const [reset, setReset] = React.useState(false)
  const [err, setError] = React.useState({ amount: false })

  async function transfer() {
    const amountToTransfer = parseFloat(amount)
    fetch('/transferBalance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromAccountId, toAccountId, amount: amountToTransfer }),
    })
      .then(async res => {
        check(res.status === 200)
        alert('Transfer successful!')
        navigate(getPath(Route.PROFILE))
      })
      .catch(err => {
        toastErr('Insufficient funds!')
        setError({ amount: true })
      })
  }

  function handleTransferFrom(selectedOption?: AccountSelectOptions | AccountSelectOptions[] | null) {
    if (Array.isArray(selectedOption)) {
      return
    }
    setTransferFromAccountId(selectedOption!.value)
    setTransferToAccountId(-1)
    setReset(true)
  }

  function handleTransferTo(selectedOption?: AccountSelectOptions | AccountSelectOptions[] | null) {
    if (Array.isArray(selectedOption)) {
      return
    }
    setReset(false)
    setTransferToAccountId(selectedOption!.value)
  }

  const user = useContext(UserContext).user
  const { data } = useQuery<FetchAccounts, FetchAccountsVariables>(fetchAccounts, {
    variables: { id: user!.id },
  })
  const userAccounts = data?.user?.account!

  return (
    <>
      <div>
        <label className="db fw4 lh-copy f6">Transfer From</label>
        {userAccounts && (
          <SelectAccount handleChange={handleTransferFrom} isDisabled={false} userAccounts={userAccounts} />
        )}
      </div>
      <Spacer $h2 />
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
        <div className="mt3">
          <label className="db fw4 lh-copy f6">Amount</label>
          <Input $hasError={err.amount} $onChange={setAmount} name="amount" type="amount" />
        </div>
      </div>
      <div className="mt3">
        <Button onClick={async () => await transfer()}>Transfer</Button>
      </div>
    </>
  )
}
