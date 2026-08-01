import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProjectionPeriodType } from '../entities/projection-scenario.entity';

export class ProjectionPeriodInputDto {
  @IsInt()
  @Min(0)
  periodIndex!: number;

  @IsInt()
  @Min(0)
  estimatedUnits!: number;
}

export class CreateProjectionScenarioDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedCostsPerPeriod?: number;

  @IsEnum(ProjectionPeriodType)
  periodType!: ProjectionPeriodType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectionPeriodInputDto)
  periods!: ProjectionPeriodInputDto[];
}
