import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { MlListingComponentDto } from './ml-listing-component.dto';

export class CreateMlListingDto {
  @IsString()
  @MinLength(1)
  mlItemId!: string;

  @IsOptional()
  @IsString()
  mlVariationId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MlListingComponentDto)
  components!: MlListingComponentDto[];
}
