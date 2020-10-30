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
  //const requestOwner = await User.findOne( { where : { id : exchangeRequest.user.id } } );
  //const exchangeRequestss = await ExchangeRequest.find();
  let eligibleTransac = new Map()
    const requestbidrate = (1/exchangeRequest.bidRate)
    const exchangeRequests = await ExchangeRequest.createQueryBuilder("exchangeRequest")
                                                  .leftJoinAndSelect("exchangeRequest.user", "user")
                                                  .where("fromCurrency = :requestToCountry", { requestToCountry: exchangeRequest.toCurrency })
                                                  .andWhere("toCurrency = : requestFromCurrency", { requestFromCurrency: exchangeRequest.fromCurrency })
                                                  .andWhere("bidRate >= : requestBidRate", { requestBidRate : requestbidrate } )
                                                  .getMany()
    if (exchangeRequests) {
      for (let i = 0; i< exchangeRequests.length; i++){
        const middleRate = ((1/exchangeRequests[i].bidRate) + exchangeRequest.bidRate)/2
        const profit = (exchangeRequests[i].amountPay * middleRate + exchangeRequest.amountPay) - (exchangeRequests[i].amountWant + exchangeRequest.amountWant*middleRate)
        if (profit >= 0) {
          eligibleTransac.set(exchangeRequests[i].requestId,profit)
        }
      }
    }
    if (eligibleTransac) {
      eligibleTransac = new Map([...eligibleTransac.entries()].sort((a,b)=>a[1]-b[1]))
      const firstValue = eligibleTransac.values().next().value;
      const firstKey = eligibleTransac.keys().next().value;
      return [firstKey,firstValue]
    }
    else {
      return [null,null]
    }
}