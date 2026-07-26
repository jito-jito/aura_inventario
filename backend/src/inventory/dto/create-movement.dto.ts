import { IsEnum, IsInt, IsOptional, IsString, IsUUID, NotEquals } from 'class-validator';
import { MovementType } from '../entities/inventory-movement.entity';

export class CreateMovementDto {
  @IsUUID()
  productId!: string;

  @IsEnum(MovementType)
  type!: MovementType;

  /** Positivo en IN/OUT. En ADJUSTMENT es el delta con signo (puede ser negativo). */
  @IsInt()
  @NotEquals(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
