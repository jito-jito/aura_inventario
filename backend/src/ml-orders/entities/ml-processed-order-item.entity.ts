import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum MlProcessedOrderItemStatus {
  PROCESSED = 'processed',
  ERROR = 'error',
}

/**
 * Registro de idempotencia: un item de una orden de Mercado Libre solo debe
 * descontar stock una vez, sin importar cuántas veces llegue la notificación.
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
