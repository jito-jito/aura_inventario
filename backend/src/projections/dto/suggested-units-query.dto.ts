import { IsEnum, IsUUID } from 'class-validator';
import { ProjectionPeriodType } from '../entities/projection-scenario.entity';

export class SuggestedUnitsQueryDto {
  @IsUUID()
  productId!: string;

  @IsEnum(ProjectionPeriodType)
  periodType!: ProjectionPeriodType;
}
