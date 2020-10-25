import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { ExchangeRequest as GraphqlExReq } from '../graphql/schema.types'

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
}
