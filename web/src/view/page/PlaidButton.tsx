import * as React from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { toastErr } from '../toast/toast'

interface PlaidLinkProps {
  link_token: string
}

export function PlaidButton(props: PlaidLinkProps) {
  const onSuccess = React.useCallback(async (token, metadata) => {
    console.log('onSuccess', token, metadata)
    fetch('/getPlaidAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_token: token }),
    })
      .then(res => {
        alert('Successfully connected with external bank accounts!')
        window.location.reload()
      })
      .catch(err => {
        toastErr(err)
      })
  }, [])

  const onEvent = React.useCallback((eventName, metadata) => console.log('onEvent', eventName, metadata), [])

  const onExit = React.useCallback((err, metadata) => console.log('onExit', err, metadata), [])

  const config = {
    token: props.link_token,
    onSuccess,
    onEvent,
    onExit,
  }

  const { open, ready } = usePlaidLink(config)
  return (
    <button onClick={() => open()} disabled={!ready}>
      Link an external bank account
    </button>
  )
}
