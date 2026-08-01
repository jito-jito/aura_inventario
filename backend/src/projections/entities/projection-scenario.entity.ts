import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { ProjectionPeriod } from './projection-period.entity';

export enum ProjectionPeriodType {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * Escenario de simulación financiera: costo, precio de venta y costos fijos
 * hipotéticos para proyectar ganancia y punto de equilibrio en el tiempo.
 * Es un módulo separado de solo lectura hacia el catálogo/inventario real:
 * no modifica el costo del producto ni descuenta stock. Si está vinculado a
 * un producto, `unitCost` solo se precarga desde `product.cost` al crear el
 * escenario; a partir de ahí vive de forma independiente.
 */
@Entity('projection_scenarios')
export class ProjectionScenario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product!: Product | null;

  @Column({ name: 'product_id', nullable: true })
  productId!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitCost!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  fixedCostsPerPeriod!: string;

  @Column({ type: 'enum', enum: ProjectionPeriodType, default: ProjectionPeriodType.MONTHLY })
  periodType!: ProjectionPeriodType;

  @OneToMany(() => ProjectionPeriod, (period) => period.scenario, { cascade: true })
  periods!: ProjectionPeriod[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
