import { useQuery } from '@apollo/client'
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
            <Accounts num={0} />
            <Accounts num={1} />
            <Accounts num={2} />
            <Accounts num={3} />
            <Accounts num={4} />
            <Accounts num={5} />
            <Accounts num={6} />
            <Accounts num={7} />
            <Accounts num={8} />
            <Accounts num={9} />
            <Accounts num={10} />
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

function Accounts(props: { num: number }) {
  const user = useContext(UserContext).user
  const { loading, data } = useQuery<FetchAccounts, FetchAccountsVariables>(fetchAccounts, {
    variables: { id: user!.id },
  })

  if (loading) {
    return <div>loading...</div>
  }

  const userAccounts = data?.user?.account!

  var err: string = 'No Accounts Linked'
  if (userAccounts[props.num]) {
    return (
      <TR>
        <BodyText>
          <TD>{userAccounts[props.num].name}</TD>
          <TD>{userAccounts[props.num].balance}</TD>
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
