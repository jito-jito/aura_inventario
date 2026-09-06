import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MlConnection } from '../mercadolibre/entities/ml-connection.entity';
import { MlListing } from '../ml-listings/entities/ml-listing.entity';
import { MlOrderFetchError } from '../ml-orders/entities/ml-order-fetch-error.entity';
import { MlProcessedOrderItem } from '../ml-orders/entities/ml-processed-order-item.entity';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MlConnection, MlListing, MlProcessedOrderItem, MlOrderFetchError]),
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
})
export class MonitoringModule {}
