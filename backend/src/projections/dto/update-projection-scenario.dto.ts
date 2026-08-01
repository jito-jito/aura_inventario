import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProjectionPeriodType } from '../entities/projection-scenario.entity';
import { ProjectionPeriodInputDto } from './create-projection-scenario.dto';

export class UpdateProjectionScenarioDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedCostsPerPeriod?: number;

  @IsOptional()
  @IsEnum(ProjectionPeriodType)
  periodType?: ProjectionPeriodType;

  /** Si se envía, reemplaza por completo la serie de períodos existente. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectionPeriodInputDto)
  periods?: ProjectionPeriodInputDto[];
}
