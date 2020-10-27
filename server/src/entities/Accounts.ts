import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Account as GraphqlUser, UserType } from '../graphql/schema.types'

@Entity()
export class Account extends BaseEntity implements GraphqlUser {
  @PrimaryGeneratedColumn()
  id: number

  @CreateDateColumn()
  timeCreated: Date

  @UpdateDateColumn()
  timeUpdated: Date

  @Column()
  accountID: number

  @Column()
  userID: number

  @Column({
    length: 100,
  })
  balance: string

  country: string

  type: string
}
