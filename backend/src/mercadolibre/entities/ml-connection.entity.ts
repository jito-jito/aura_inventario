import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { encryptedColumnTransformer } from '../encrypted-column.transformer';

export enum MlConnectionStatus {
  CONNECTED = 'connected',
  ERROR = 'error',
}

@Entity('ml_connection')
export class MlConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ml_user_id' })
  mlUserId!: string;

  @Column({ type: 'varchar', nullable: true })
  nickname!: string | null;

  @Column({ type: 'text', transformer: encryptedColumnTransformer })
  accessToken!: string;

  @Column({ type: 'text', transformer: encryptedColumnTransformer })
  refreshToken!: string;

  @Column({ default: 'bearer' })
  tokenType!: string;

  @Column({ type: 'varchar', nullable: true })
  scope!: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'enum', enum: MlConnectionStatus, default: MlConnectionStatus.CONNECTED })
  status!: MlConnectionStatus;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
