import { useQuery, useSubscription } from '@apollo/client'
import { RouteComponentProps } from '@reach/router'
import * as React from 'react'
import { useContext } from 'react'
import { ColorName, Colors } from '../../../../common/src/colors'
import { FetchAccounts, FetchAccountsVariables } from '../../graphql/query.gen'
import { H2 } from '../../style/header'
import { Spacer } from '../../style/spacer'
import { style } from '../../style/styled'
import { BodyText, IntroText } from '../../style/text'
import { fetchAccounts } from '../accounts/fetchAccounts'
import { UserContext } from '../auth/user'
import { AppRouteParams } from '../nav/route'
import { toastErr } from '../toast/toast'
import { Page } from './Page'
import { PlaidButton } from './PlaidButton'

interface ProfilePageProps extends RouteComponentProps, AppRouteParams {}

export function ProfilePage(props: ProfilePageProps) {
  const [linkToken, setLinkToken] = React.useState('')
  if (!linkToken) {
    fetch('/getPlaidLinkToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res: any) => {
        setLinkToken((await res.json()).link_token)
      })
      .catch(err => {
        console.log(err)
        toastErr('Could not retrieve Plaid link token!')
      })
  }

  const user = useContext(UserContext).user
  var { loading, data } = useQuery<FetchAccounts, FetchAccountsVariables>(fetchAccounts, {
    variables: { id: user!.id },
  })

  if (loading) {
    return <div>loading...</div>
  }

  var userAccounts = data?.user?.account!

  const sub = useSubscription<AccountsSubscription, AccountsSubscriptionVariables>(subscribeAccounts, {
    variables: { userId },
  })
  useEffect(() => {
    if (sub.data?.accountUpdates) {
      if (sub.data.accountUpdates.userId === user!.id) {
        var { loading1, data1 } = useQuery<FetchAccounts, FetchAccountsVariables>(fetchAccounts, {
          variables: { id: user!.id },
        })

        if (loading1) {
          return <div>loading...</div>
        }

        userAccounts = data1?.user?.account!
      }
    }
  }, [sub.data])

  return (
    <Page>
      <Section>
        <H2>Profile</H2>
        <Spacer $h4 />
        <IntroText>Welcome to your Profile Page!</IntroText>
        <Spacer $h4 />
        <Table>
          <tbody>
            <Name header="Name:" />
            <Id header="ID Number:" />
          </tbody>
        </Table>
        <Spacer $h6 />
        <IntroText>Accounts Information</IntroText>
        <Table>
          <tbody>
            <AccountHeader name="Account Name" balance="Balance" />
            <Accounts acc={userAccounts[0]} num={0} />
            <Accounts acc={userAccounts[1]} num={1} />
            <Accounts acc={userAccounts[2]} num={2} />
            <Accounts acc={userAccounts[3]} num={3} />
            <Accounts acc={userAccounts[4]} num={4} />
            <Accounts acc={userAccounts[5]} num={5} />
            <Accounts acc={userAccounts[6]} num={6} />
            <Accounts acc={userAccounts[7]} num={7} />
            <Accounts acc={userAccounts[8]} num={8} />
            <Accounts acc={userAccounts[9]} num={9} />
            <Accounts acc={userAccounts[10]} num={10} />
            <Accounts acc={userAccounts[11]} num={11} />
            <Accounts acc={userAccounts[12]} num={12} />
          </tbody>
        </Table>
        <Spacer $h4 />
      </Section>
      <PlaidButton link_token={linkToken} />
    </Page>
  )
}

function Name(props: { header: string }) {
  return (
    <TR>
      <BodyText>
        <TD>{props.header}</TD>
        <TD>{useContext(UserContext).displayName()}</TD>
      </BodyText>
    </TR>
  )
}

function Id(props: { header: string }) {
  return (
    <TR>
      <BodyText>
        <TD>{props.header}</TD>
        <TD>{useContext(UserContext).displayId()}</TD>
      </BodyText>
    </TR>
  )
}

function AccountHeader(props: { name: string; balance: string }) {
  return (
    <TR>
      <BodyText>
        <TD>{props.name}</TD>
        <TD>{props.balance}</TD>
      </BodyText>
    </TR>
  )
}

function Accounts(props: { acc: any; num: number }) {
  const err = 'No Accounts Linked'
  if (props.acc) {
    return (
      <TR>
        <BodyText>
          <TD>{props.acc.name}</TD>
          <TD>{props.acc.balance}</TD>
        </BodyText>
      </TR>
    )
  } else if (props.num == 0) {
    return (
      <TR>
        <BodyText>
          <TD>{err}</TD>
        </BodyText>
      </TR>
    )
  } else {
    return null
  }
}

const Table = style('table', 'w-100 ba b--black')

const Section = style('div', 'mb4 mid-gray ba b--mid-gray br2 pa3', (p: { $color?: ColorName }) => ({
  borderLeftColor: Colors[p.$color || 'lemon'] + '!important',
  borderLeftWidth: '3px',
}))

const TR = style('tr', 'ba b--black')

const TD = style('td', 'mid-gray pa3 v-mid', { minWidth: '7em' })
