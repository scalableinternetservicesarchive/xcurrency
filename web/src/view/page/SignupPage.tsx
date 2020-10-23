import { RouteComponentProps } from '@reach/router'
import * as bcrypt from 'bcryptjs'
import * as React from 'react'
import { Button } from '../../style/button'
import { Input } from '../../style/input'
import { Spacer } from '../../style/spacer'
import { AppRouteParams } from '../nav/route'
import { toastErr } from '../toast/toast'
import { Page } from './Page'
const plaid = require('plaid')

interface SignupPageProps extends RouteComponentProps, AppRouteParams {}

export class SignupPage extends React.Component {
  constructor(props: SignupPageProps) {
    super(props)
  }

  componentDidMount() {
    const script = document.createElement('script')
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.async = true
    document.body.appendChild(script)
  }

  render() {
    return (
      <Page>
        <Signup />
      </Page>
    )
  }
}

function Signup() {
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [country, setCountry] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [err, setError] = React.useState({ email: false, password: false })

  // reset error when email/password change
  React.useEffect(() => setError({ ...err, email: !validateEmail(email) }), [email])
  React.useEffect(() => setError({ ...err, password: false }), [password])

  function signup() {
    if (!validateForm(email, password, setError)) {
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
          body: JSON.stringify({ name, email, password: hashedPassword, country }),
        })
          .then(() => {
            console.log('successfully created user')
          })
          .then(() => {
            return fetch('/get_link_token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            })
          })
          .then(token => {
            const linkHandler = plaid.create({
              token,
              onSuccess: (public_token: string) => {
                // Send the public_token to your app server.
                fetch('/get_access_token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ public_token }),
                })
              },
            })
            linkHandler.open()
          })
      }
    })
  }

  return (
    <>
      <div className="mt3">
        <label className="db fw4 lh-copy f6" htmlFor="name">
          Name
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
      <Spacer $h5 />
      <div>
        <label className="db fw4 lh-copy f6" htmlFor="countries">
          Country
        </label>
        <select
          value={country}
          onChange={event => {
            setCountry(event.target.value)
          }}
        >
          <option value="United States">United States</option>
          <option value="Canada">Canada</option>
          <option value="Japan">Japan</option>
          <option value="Brazil">Brazil</option>
        </select>
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

  setError({ email: !validEmail, password: !validPassword })
  console.log('valid', validEmail, validPassword)
  return validEmail && validPassword
}
