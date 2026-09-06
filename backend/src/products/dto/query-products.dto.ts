import { IsIn, IsOptional, IsString } from 'class-validator';

export type StockStatusFilter = 'critical' | 'ok';
export type StockSortDirection = 'asc' | 'desc';

export class QueryProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['critical', 'ok'])
  stockStatus?: StockStatusFilter;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortByStock?: StockSortDirection;
}
