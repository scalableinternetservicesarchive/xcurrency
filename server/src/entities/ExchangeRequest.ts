import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { ExchangeRequest as GraphqlExReq } from '../graphql/schema.types'
import { User } from './User'

@Entity()
export class ExchangeRequest extends BaseEntity implements GraphqlExReq {
    @PrimaryGeneratedColumn()
    requestId: number

    @CreateDateColumn()
    timeCreated: Date

    @Column()
    amountWant: number

    @Column()
    amountPay: number

    @Column()
    bidRate: number

    @Column()
    currentRate: number

    @Column({
      length: 10
    })
    fromCurrency: string

    @Column({
      length: 10,
    })
    toCurrency: string

    @ManyToOne(()=>User, user => user.exchangeRequest)
    user: User
}
