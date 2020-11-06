import { navigate, RouteComponentProps } from '@reach/router'
import * as bcrypt from 'bcryptjs'
import * as React from 'react'
import { check } from '../../../../common/src/util'
import { Button } from '../../style/button'
import { Input } from '../../style/input'
import { Spacer } from '../../style/spacer'
import { AppRouteParams, getPath, Route } from '../nav/route'
import { toastErr } from '../toast/toast'
import { Page } from './Page'

interface SignupPageProps extends RouteComponentProps, AppRouteParams {}

export function SignupPage(props: SignupPageProps) {
  return (
    <Page>
      <Signup />
    </Page>
  )
}

function Signup() {
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [passwordConfirmation, setPasswordConfirmation] = React.useState('')
  const [err, setError] = React.useState({ email: false, password: false })

  // reset error when email/password change
  React.useEffect(() => setError({ ...err, email: !validateEmail(email) }), [email])
  React.useEffect(() => setError({ ...err, password: false }), [password])
  React.useEffect(() => setError({ ...err, password: false }), [name])

  async function signup() {
    if (!validateForm(email, password, passwordConfirmation, setError)) {
      return
    }

    const saltRounds = 10
    bcrypt.hash(password, saltRounds, function (err, hashedPassword) {
      if (err) {
        console.log("Couldn't hash the password!")
      } else {
        fetch('/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password: hashedPassword }),
        })
          .then(res => {
            check(res.ok)
            navigate(getPath(Route.LOGIN))
            window.location.reload()
          })
          .catch(err => {
            toastErr('An account is already associated with this user!')
          })
      }
    })
  }

  return (
    <>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="name">
          Full name
        </label>
        <Input $onChange={setName} name="Full name" type="name" />
      </div>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="email">
          Email address
        </label>
        <Input $hasError={err.email} $onChange={setEmail} name="email" type="email" />
      </div>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="password">
          Password
        </label>
        <Input $hasError={err.password} $onChange={setPassword} name="password" type="password" />
      </div>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="password-confirmation">
          Confirm password
        </label>
        <Input
          $hasError={err.password}
          $onChange={setPasswordConfirmation}
          name="password-confirmation"
          type="password"
        />
      </div>
      <Spacer $h5 />
      <div className="mt3">
        <Button onClick={signup}>Sign up</Button>
      </div>
    </>
  )
}

async function validateEmail(email: string) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return re.test(String(email).toLowerCase())
}

function validateForm(
  email: string,
  password: string,
  passwordConfirmation: string,
  setError: React.Dispatch<React.SetStateAction<{ email: boolean; password: boolean }>>
) {
  const validEmail = validateEmail(email)
  if (!validEmail) {
    toastErr('Invalid email format!')
  }

  const validPassword = Boolean(password) && password.length >= 8
  if (!validPassword) {
    toastErr('Password must be at least 8 characters long!')
  }

  const isPasswordConsistent = Boolean(passwordConfirmation) && password === passwordConfirmation
  if (!isPasswordConsistent) {
    toastErr('Passwords must match!')
  }

  setError({ email: !validEmail, password: !validPassword })
  return validEmail && validPassword && isPasswordConsistent
}
