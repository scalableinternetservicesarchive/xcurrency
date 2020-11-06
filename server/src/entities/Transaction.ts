import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Transaction extends BaseEntity {
    @PrimaryGeneratedColumn()
    transacId: number

    @CreateDateColumn()
    timeCreated: Date

    @Column()
    requestId1: number

    @Column()
    requestId2: number

    @Column("decimal", { precision: 10, scale : 2})
    profit: number
}