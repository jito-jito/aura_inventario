import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  sku!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  cost!: string;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'int', default: 5 })
  minStock!: number;

  @OneToMany(() => InventoryMovement, (movement) => movement.product)
  movements!: InventoryMovement[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
