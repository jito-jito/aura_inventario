import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

export enum MovementType {
  IN = 'in',
  OUT = 'out',
  ADJUSTMENT = 'adjustment',
}

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, (product) => product.movements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  productId!: string;

  @Column({ type: 'enum', enum: MovementType })
  type!: MovementType;

  /** Delta aplicado al stock: siempre positivo en IN/OUT, con signo en ADJUSTMENT. */
  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'int' })
  balanceAfter!: number;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  reference!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
