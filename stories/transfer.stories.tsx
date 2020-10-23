import { Meta, Story } from '@storybook/react'
import * as React from 'react'
import { ExchangeForm as ExchangeComponet } from '../web/src/view/exchange/exchange_form'

export default {
  title: 'Exchange',
} as Meta

const ExchangeTemplate: Story = args => <ExchangeComponet {...args} />

export const Exchange  = ExchangeTemplate.bind({})
Exchange.args = {};