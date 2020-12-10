import http from 'k6/http'
import { sleep } from 'k6'
import { Counter, Rate } from 'k6/metrics'

export const options = {
  scenarios: {
    example_scenario: {
      // name of the executor to use
      executor: 'ramping-arrival-rate',
      // common scenario configuration
      startRate: '50',
      timeUnit: '1s',
      // executor-specific configuration
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { target: 200, duration: '30s' },
        { target: 0, duration: '30s' },
      ],
    },
  },
}


const count200 = new Counter('status_code_2xx')
const count300 = new Counter('status_code_3xx')
const count400 = new Counter('status_code_4xx')
const count500 = new Counter('status_code_5xx')

const rate200 = new Rate('rate_status_code_2xx')
const rate300 = new Rate('rate_status_code_3xx')
const rate400 = new Rate('rate_status_code_4xx')
const rate500 = new Rate('rate_status_code_5xx')

function recordRates(res) {
  if (res.status >= 200 && res.status < 300) {
    count200.add(1)
    rate200.add(1)
  } else if (res.status >= 300 && res.status < 400) {
    console.log(res.body)
    count300.add(1)
    rate300.add(1)
  } else if (res.status >= 400 && res.status < 500) {
    count400.add(1)
    rate400.add(1)
  } else if (res.status >= 500 && res.status < 600) {
    count500.add(1)
    rate500.add(1)
  }
}


export default function () {
  // console.log(`VU: ${__VU}  -  ITER: ${__ITER}`)


  // Sign up for an account
  // recordRates(http.get('http://localhost:3000/app/index'))
  // sleep(2);
  // recordRates(http.get('http://localhost:3000/app/signup'))
  // sleep(2);


  const headers = {
    'Content-Type': 'application/json',
  }
  const uniqueUser = `${__VU}-${__ITER}`;
  // recordRates(http.get("http://localhost:3000/app/index"))
  recordRates(http.post('https://xcurrency.cloudcity.computer/auth/signup', `{"name":"${uniqueUser}","email":"${uniqueUser}@gmail.com","password":"12345678"}`, {headers: headers}))


  // After signing up, you are redirected to login to the account automatically
  // sleep(2);
  recordRates(http.post('https://xcurrency.cloudcity.computer/auth/login', `{"email":"${uniqueUser}@gmail.com","password":"12345678"}`, {headers: headers}))

}