import http from 'k6/http'
import { sleep } from 'k6'
import { Counter, Rate } from 'k6/metrics'
import { randomSeed } from 'k6'

//********************Use need to seed database to start the testing***************************
//seed user accounts for 5 users with USD and CAD internal accounts. seed Admin accounts

/*
export const options = {
  scenarios: {
    example_scenario: {
      // name of the executor to usei
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

export default function () {
  // recordRates(
  const resp = http.post(
    'http://localhost:3000/graphql',
    '{"operationName":"AnswerSurveyQuestion","variables":{"input":{"answer":"🤗","questionId":1}},"query":"mutation AnswerSurveyQuestion($input: SurveyInput!) {\\n  answerSurvey(input: $input)\\n}\\n"}',
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
  // )
  sleep(1)
  http.get('http://localhost:3000')
}*/

export const options = {
  scenarios: {
    example_scenario: {
      // name of the executor to use
      executor: 'constant-vus',
      vus: 5,
      duration: '10s',
    },
  },
}

//seed user accounts + currency accounts in db
export default function () {
  //randomSeed(152371677930);
  const email = `user${__VU}@gmail.com`;
  const payloadLogin = JSON.stringify({ email: email, password: 'test12345' });
  const paramsLogin = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post('http://localhost:3000/auth/login', payloadLogin, paramsLogin);
  //sleep(1)
  //each logged in user, create multiple requests
  const amountWant = Math.random() * 20;
  const bidRateArrUSDTOCAD = [1.0,1.2,1.5]
  const bidRateArrCADTOUSD = [0.6,0.7,0.9]
  const fromCountryArr = ['USD','CAD']
  const pickRate = Math.floor(Math.random() * Math.floor(3));
  const pickCountry = Math.floor(Math.random() * Math.floor(2));
  const fromCountry = fromCountryArr[pickCountry]
  const currentRate = 1
  let toCountry = null;
  let bidRate = null;
  if (fromCountry == 'USD') {
    toCountry = 'CAD'
    bidRate = bidRateArrUSDTOCAD[pickRate]
  }
  else {
    toCountry = 'USD'
    bidRate = bidRateArrCADTOUSD[pickRate]
  }
  const value = (1/Number(bidRate)) * Number(amountWant);
  const amountPay = Number(value.toPrecision(3))

  const requestPayload = JSON.stringify({ amountPay: amountPay, amountWant: amountWant, bidRate: bidRate, currentRate: currentRate,
  fromCurrency: fromCountry, toCurrency: toCountry })
  http.post('http://localhost:3000/confirm-request', requestPayload, paramsLogin)
  //sleep(1)
  //each user view their requests in transfer pages
  const query = `{operationName":"FetchExchangeRequests","variables":{"id":1},"query":"query FetchExchangeRequests($id: Int) {\n  exchangeRequests(id: $id) {\n    ...ExchangeRequest\n    __typename\n  }\n}\n\nfragment ExchangeRequest on ExchangeRequest {\n  requestId\n  amountWant\n  bidRate\n  amountPay\n  currentRate\n  fromCurrency\n  toCurrency\n  __typename\n}\n"}`;
  http.post('http://localhost:3000/graphql', JSON.stringify({ query: query }), paramsLogin)
  //each user logout.
  http.post('http://localhost:3000/auth/logout', {}, paramsLogin)

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