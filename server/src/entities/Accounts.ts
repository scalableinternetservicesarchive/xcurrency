import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Account as GraphqlUser } from '../graphql/schema.types'
import { User } from './User'

@Entity()
export class Account extends BaseEntity implements GraphqlUser {
  @PrimaryGeneratedColumn()
  id: number

  @CreateDateColumn()
  timeCreated: Date

  @UpdateDateColumn()
  timeUpdated: Date

  @Column({
    length: 100,
  })
  country: string

  type: string

  @Column("decimal", { precision: 10, scale : 2})
  balance: number

  @ManyToOne(()=> User, user => user.account)
  user: User

}

