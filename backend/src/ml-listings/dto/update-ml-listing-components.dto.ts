import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { MlListingComponentDto } from './ml-listing-component.dto';

export class UpdateMlListingComponentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MlListingComponentDto)
  components!: MlListingComponentDto[];
}
