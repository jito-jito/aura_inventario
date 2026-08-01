import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectionScenario } from './projection-scenario.entity';

/** Unidades estimadas de venta para un período puntual (mes 0, mes 1, ...) de un escenario. */
@Entity('projection_periods')
@Index(['scenarioId', 'periodIndex'])
export class ProjectionPeriod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProjectionScenario, (scenario) => scenario.periods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenario_id' })
  scenario!: ProjectionScenario;

  @Column({ name: 'scenario_id' })
  scenarioId!: string;

  @Column({ type: 'int' })
  periodIndex!: number;

  @Column({ type: 'int' })
  estimatedUnits!: number;
}
