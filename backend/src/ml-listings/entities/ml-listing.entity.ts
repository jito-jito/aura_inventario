import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MlListingComponent } from './ml-listing-component.entity';

export enum MlListingSyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  ERROR = 'error',
}

/**
 * Una publicación de Mercado Libre puede corresponder a más de un producto interno
 * (ej. una publicación de "cuadro" que consume un lienzo y un marco por unidad
 * vendida). La composición vive en `components` (ver MlListingComponent).
 */
@Entity('ml_listings')
@Index(['mlItemId', 'mlVariationId'])
export class MlListing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  mlItemId!: string;

  @Column({ type: 'varchar', nullable: true })
  mlVariationId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  title!: string | null;

  @OneToMany(() => MlListingComponent, (component) => component.listing, {
    cascade: true,
  })
  components!: MlListingComponent[];

  @Column({ type: 'enum', enum: MlListingSyncStatus, default: MlListingSyncStatus.PENDING })
  syncStatus!: MlListingSyncStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastSyncError!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
