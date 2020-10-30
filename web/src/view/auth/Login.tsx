import { navigate } from '@reach/router'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { check } from '../../../../common/src/util'
import { Button } from '../../style/button'
import { Input } from '../../style/input'
import { Spacer } from '../../style/spacer'
import { getPath, Route } from '../nav/route'
import { toastErr } from '../toast/toast'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setError] = useState({ email: false, password: false })

  // reset error when email/password change
  useEffect(() => setError({ ...err, email: !validateEmail(email) }), [email])
  useEffect(() => setError({ ...err, password: false }), [password])

  function login() {
    if (!validate(email, password, setError)) {
      toastErr('Please enter a valid email or password!')
      return
    }
    fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(res => {
        check(res.status == 200)
        navigate(getPath(Route.PROFILE))
      })
      .catch(err => {
        toastErr("The email or password you've entered is incorrect!")
        setError({ email: true, password: true })
      })
  }

  return (
    <>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="email">
          Email address
        </label>
        <Input $hasError={err.email} $onChange={setEmail} $onSubmit={login} name="email" type="email" />
      </div>
      <Spacer $h1 />
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="password">
          Password
        </label>
        <Input $hasError={err.password} $onChange={setPassword} $onSubmit={login} name="password" type="password" />
      </div>
      <Spacer $h5 />
      <div className="mt3">
        <Button onClick={login}>Login</Button>
      </div>
    </>
  )
}

function validateEmail(email: string) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return re.test(String(email).toLowerCase())
}

function validate(
  email: string,
  password: string,
  setError: React.Dispatch<React.SetStateAction<{ email: boolean; password: boolean }>>
) {
  const validEmail = validateEmail(email)
  const validPassword = Boolean(password)
  setError({ email: !validEmail, password: !validPassword })
  return validEmail && validPassword
}
