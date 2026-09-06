import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Falla al consultar el detalle de una orden en la API de Mercado Libre (por ejemplo,
 * 403 porque la orden no pertenece a la cuenta conectada, o un error de red). Ocurre
 * antes de poder identificar la publicación/producto involucrado, por eso no encaja en
 * MlProcessedOrderItem. Un registro por orden: se sobreescribe en cada reintento fallido
 * y se borra si la orden se llega a consultar con éxito más adelante.
 */
@Entity('ml_order_fetch_errors')
export class MlOrderFetchError {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  mlOrderId!: string;

  @Column({ type: 'text' })
  message!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
