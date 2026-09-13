import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { MlProcessedOrderItemStatus } from '../entities/ml-processed-order-item.entity';

export class QueryProcessedOrdersDto {
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @IsOptional()
  @IsIn([
    MlProcessedOrderItemStatus.PENDING,
    MlProcessedOrderItemStatus.PROCESSED,
    MlProcessedOrderItemStatus.ERROR,
  ])
  status?: MlProcessedOrderItemStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
