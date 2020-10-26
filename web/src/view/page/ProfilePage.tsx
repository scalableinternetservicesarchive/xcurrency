import { RouteComponentProps } from '@reach/router'
import * as React from 'react'
import { ColorName, Colors } from '../../../../common/src/colors'
import { H2 } from '../../style/header'
import { Spacer } from '../../style/spacer'
import { style } from '../../style/styled'
import { BodyText, IntroText } from '../../style/text'
import { AppRouteParams } from '../nav/route'
import { Page } from './Page'

interface ProfilePageProps extends RouteComponentProps, AppRouteParams {}

export function ProfilePage(props: ProfilePageProps) {
  return (
    <Page>
      <Section>
        <H2>Profile</H2>
        <Spacer $h4 />
        <IntroText>Welcome to your Profile Page!</IntroText>
        <Spacer $h4 />
        <Table>
          <tbody>
            <Name
              header="Name"
              name="Joe Bruin"
            />
            <Id
              header="ID Number"
              id="1111"
            />
          </tbody>
        </Table>
        <Spacer $h4 />
        <IntroText>Accounts Information</IntroText>
        <Table>
          <tbody>
            <Account
              country="Country"
              balance="Balance"
            />
            <Account
              country="USA"
              balance="$30"
            />
            <Account
              country="UK"
              balance="€30"
            />
          </tbody>
        </Table>
        <Spacer $h4 />
        <IntroText>Transfers Information</IntroText>
        <Table>
          <tbody>
            <Transfer
              countryFrom="Money From"
              countryTo="Money Transfered To"
              conversion="Conversion"
            />
            <Transfer
              countryFrom="UK"
              countryTo="USA"
              conversion="€30 -> $40"
            />
          </tbody>
        </Table>
      </Section>
    </Page>
  )
}

function Name(props: {
  header: string
  name: string
}) {
  return (
    <TR>
      <BodyText>
        <TD>{props.header}</TD>
        <TD>{props.name}</TD>
      </BodyText>
    </TR>
  )
}

function Id(props: {
  header: string
  id: string
}) {
  return (
    <TR>
      <BodyText>
        <TD>{props.header}</TD>
        <TD>{props.id}</TD>
      </BodyText>
    </TR>
  )
}

function Account(props: {
  country: string
  balance: string
}) {
  return (
    <TR>
      <BodyText>
        <TD>{props.country}</TD>
        <TD>{props.balance}</TD>
      </BodyText>
    </TR>
  )
}

function Transfer(props: {
  countryFrom: string
  countryTo: string
  conversion: string
}) {
  return (
    <TR>
      <BodyText>
        <TD>{props.countryFrom}</TD>
        <TD>{props.countryTo}</TD>
        <TD>{props.conversion}</TD>
      </BodyText>
    </TR>
  )
}

const Table = style('table', 'w-100 ba b--black')

const Section = style('div', 'mb4 mid-gray ba b--mid-gray br2 pa3', (p: { $color?: ColorName }) => ({
  borderLeftColor: Colors[p.$color || 'lemon'] + '!important',
  borderLeftWidth: '3px',
}))

const TR = style('tr', 'ba b--black')

const TD = style('td', 'mid-gray pa3 v-mid', { minWidth: '7em' })
