import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

export enum MlProcessedOrderItemStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  ERROR = 'error',
}

/**
 * Registro de idempotencia: un item de una orden de Mercado Libre solo debe
 * descontar stock una vez, sin importar cuántas veces llegue la notificación.
 * Además funciona como cola de revisión: llega en `pending` sin tocar stock,
 * y recién pasa a `processed` cuando alguien lo confirma manualmente desde
 * la pantalla de Ventas (ver `MlOrdersService.confirmOrderItem`).
 */
@Entity('ml_processed_order_items')
@Index(['mlOrderId', 'mlItemId', 'mlVariationId'])
export class MlProcessedOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  mlOrderId!: string;

  @Column()
  mlItemId!: string;

  @Column({ type: 'varchar', nullable: true })
  mlVariationId!: string | null;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column()
  productId!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column()
  orderStatus!: string;

  @Column({ type: 'enum', enum: MlProcessedOrderItemStatus })
  status!: MlProcessedOrderItemStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  processedAt!: Date;
}
