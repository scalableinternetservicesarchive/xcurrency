import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './User'

@Entity()
export class TransactionRecord extends BaseEntity {
    @PrimaryGeneratedColumn()
    transacId: number

    @ManyToOne(()=>User, user => user.transactionRecord)
    user: User

    @CreateDateColumn()
    timeCreated: Date

    @Column()
    requestId1: number

    @Column()
    requestId2: number

    @Column("decimal", { precision: 10, scale : 2})
    profit: number
}