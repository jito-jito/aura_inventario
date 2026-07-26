import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateMlListingDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @MinLength(1)
  mlItemId!: string;

  @IsOptional()
  @IsString()
  mlVariationId?: string;
}
