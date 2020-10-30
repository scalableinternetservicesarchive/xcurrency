import { BaseEntity, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { User as GraphqlUser, UserType } from '../graphql/schema.types'
import { Account } from './Accounts'
import { ExchangeRequest } from './ExchangeRequest'

@Entity()
export class User extends BaseEntity implements GraphqlUser {
  @PrimaryGeneratedColumn()
  id: number

  @CreateDateColumn()
  timeCreated: Date

  @UpdateDateColumn()
  timeUpdated: Date

  @Column({
    length: 100,
  })
  email: string

  @Column({
    type: 'enum',
    enum: UserType,
    default: UserType.User,
  })
  userType: UserType

  @Column({
    length: 100,
    nullable: true,
  })
  name: string

  @Column({
    length: 100,
  })
  password: string

  country: string

  @OneToMany(() => ExchangeRequest, exchangeRequest => exchangeRequest.user)
  exchangeRequest: ExchangeRequest[];

  @OneToMany(()=> Account, account => account.user)
  account: Account[];

}
