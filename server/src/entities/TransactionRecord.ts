import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class TransactionRecord extends BaseEntity {
    @PrimaryGeneratedColumn()
    transacId: number

    @Column()
    user1Id: number

    @Column()
    user2Id: number

    @CreateDateColumn()
    timeCreated: Date

    @Column()
    requestId1: number

    @Column()
    requestId2: number

}