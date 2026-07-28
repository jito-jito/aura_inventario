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
import { MlListing } from './ml-listing.entity';

/** Un producto interno que forma parte de una publicación (kit), con la cantidad que se consume por cada unidad vendida. */
@Entity('ml_listing_components')
@Index(['listingId', 'productId'])
export class MlListingComponent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MlListing, (listing) => listing.components, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: MlListing;

  @Column({ name: 'listing_id' })
  listingId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  productId!: string;

  @Column({ type: 'int', default: 1 })
  quantityPerUnit!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
