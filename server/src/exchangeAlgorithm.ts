import { ExchangeRequest } from './entities/ExchangeRequest';
//const role = Object.freeze({"buyer": 1, "seller": 2})
export class exReq {
  userId : number
  bidRate : number
  amountPay : number
  amountWant : number
  fromCurrency : string
  toCurrency : string

  constructor(userId : number, bidRate : number, amountPay : number, amountWant : number,fromCurrency : string, toCurrency : string) {
    this.userId = userId
    this.bidRate = bidRate
    this.amountPay = amountPay
    this.amountWant = amountWant
    this.fromCurrency = fromCurrency
    this.toCurrency = toCurrency
  }
}

export async function checkForMatch(exchangeRequest : exReq, exchangeRequests : ExchangeRequest []) {
  //let eligibleTransac = new Map()
    if (exchangeRequests) {
      for (let i = 0; i< exchangeRequests.length; i++){
        let middleRate = Number((((1/ Number(exchangeRequests[i].bidRate)) - Number(exchangeRequest.bidRate))/2) + Number(exchangeRequest.bidRate));
        let total_want = (Number( Number(exchangeRequests[i].amountWant) * middleRate) + Number(exchangeRequest.amountWant))
        let total_pay = (Number(( Number(exchangeRequest.amountPay) * middleRate)) + Number(exchangeRequests[i].amountPay))
        let profit = (total_pay - total_want)
        if (profit >= 0) {
          return [exchangeRequests[i].requestId, profit]
        }
      }
    }
    /* this is to choose the least profit. Therefore, more matches available
    if (eligibleTransac) {
      eligibleTransac = new Map([...eligibleTransac.entries()].sort((a,b)=>a[1]-b[1]))
      const firstValue = eligibleTransac.values().next().value;
      //console.log(firstValue)
      const firstKey = eligibleTransac.keys().next().value;
      //console.log(firstKey)
      return [firstKey,firstValue]
    }
    */
  return [null,null]
}