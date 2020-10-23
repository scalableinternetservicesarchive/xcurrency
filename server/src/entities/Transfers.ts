import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './User'

@Entity()
export class Transfers extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number

  @CreateDateColumn()
  timeCreated: Date

  @OneToOne(() => User)
  @JoinColumn()
  user: User

  @Column({
    length: 36,
  })
  fromCurrency: string

  @Column({
    length: 36,
  })
  toCurrency: string
}
