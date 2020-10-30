import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Account as GraphqlUser, User } from '../graphql/schema.types'


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

  @Column()
  balance: number

  @ManyToOne(()=> User, user => user.account)
  user: User

}

