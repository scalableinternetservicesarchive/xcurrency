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

export async function checkForMatch(exchangeRequest :exReq) {
  let eligibleTransac = new Map()
    const requestbidrate = (1/exchangeRequest.bidRate)
    const exchangeRequests = await ExchangeRequest.createQueryBuilder("exchange_request")
                                                  .leftJoinAndSelect("exchange_request.user", "user")
                                                  .where("fromCurrency = :requestToCountry", { requestToCountry: exchangeRequest.toCurrency })
                                                  .andWhere("toCurrency = :requestFromCurrency", { requestFromCurrency: exchangeRequest.fromCurrency })
                                                  .andWhere("bidRate <= :requestBidRate", { requestBidRate : requestbidrate } )
                                                  .getMany()
    /*console.log("All exchange Requests")
    console.log(exchangeRequests)
    console.log(requestbidrate)*/
    if (exchangeRequests) {
      for (let i = 0; i< exchangeRequests.length; i++){
        const middleRate = ((((1/exchangeRequests[i].bidRate) - exchangeRequest.bidRate)/2) + exchangeRequest.bidRate);
        //console.log(middleRate)
        let total_want = (Number((exchangeRequests[i].amountWant * middleRate)) + Number(exchangeRequest.amountWant))
        let total_pay = (Number((exchangeRequest.amountPay * middleRate)) + Number(exchangeRequests[i].amountPay))
        let profit = (total_pay - total_want)
        if (profit >= 0) {
          eligibleTransac.set(exchangeRequests[i].requestId,profit)
        }
      }
    }
    if (eligibleTransac) {
      eligibleTransac = new Map([...eligibleTransac.entries()].sort((a,b)=>a[1]-b[1]))
      const firstValue = eligibleTransac.values().next().value;
      //console.log(firstValue)
      const firstKey = eligibleTransac.keys().next().value;
      //console.log(firstKey)
      return [firstKey,firstValue]
    }
    else {
      return [null,null]
    }
}