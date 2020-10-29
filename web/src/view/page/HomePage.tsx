import { RouteComponentProps } from '@reach/router'
import * as React from 'react'
import { style } from '../../style/styled'
import { AppRouteParams} from '../nav/route'
import { Page } from './Page'
import { ExchangeForm } from './exchange_form'
interface HomePageProps extends RouteComponentProps, AppRouteParams {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function HomePage(props: HomePageProps) {
  return (
    <Page>
	
      <Content>
        <LContent>
           
              <ul className="pl4">
                <li>
                  Register. Only an email address and a bank account, credit card, or debit card are needed.
                </li>
		             <li>
                  Enter request details.
                </li>
		            <li>
                  Done! Order can be cancelled if it has not been fulfilled.
                </li>
              </ul>
            
          
        </LContent>
        <RContent>
	  
	  <ExchangeForm/>
          
      	  
        </RContent>
      </Content>
    </Page>
  )
}

const Content = style('div', 'flex-l')

const LContent = style('div', 'flex-grow-0 w-70-l mr4-l')

const RContent = style('div', 'flex-grow-0  w-30-l')

