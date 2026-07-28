import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class MlListingComponentDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantityPerUnit?: number;
}
