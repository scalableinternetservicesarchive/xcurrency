import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
//import { Account as GraphqlAccount } from '../graphql/schema.types'
import { User } from './User'

@Entity()
export class Account extends BaseEntity /*implements GraphqlAccount*/ {
  @PrimaryGeneratedColumn()
  accountId: number

  @CreateDateColumn()
  timeCreated: Date

  @UpdateDateColumn()
  timeUpdated: Date

  @Column({
    length: 100,
  })
  country: string

  type: string

  @Column()
  balance: number

  @ManyToOne(() => User, user => user.account)
  user: User
}
