import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { ExchangeRequest as GraphqlExReq } from '../graphql/schema.types'
import { User } from './User'

@Entity()
export class ExchangeRequest extends BaseEntity implements GraphqlExReq {
  @PrimaryGeneratedColumn()
  requestId: number

  @CreateDateColumn()
  timeCreated: Date

  @Column('decimal', { precision: 10, scale: 2 })
  amountWant: number

  @Column('decimal', { precision: 10, scale: 2 })
  amountPay: number

  @Column('decimal', { precision: 5, scale: 2 })
  bidRate: number

  @Column('decimal', { precision: 5, scale: 2 })
  currentRate: number

  @Column({
    length: 10,
  })
  fromCurrency: string

  @Column({
    length: 10,
  })
  toCurrency: string

  @Column()
  check: boolean

  @ManyToOne(() => User, user => user.exchangeRequest)
  user: User

  @Column()
  userId: number
}
