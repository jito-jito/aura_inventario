import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module';
import { MercadolibreModule } from '../mercadolibre/mercadolibre.module';
import { MlListing } from '../ml-listings/entities/ml-listing.entity';
import { MlOrderFetchError } from './entities/ml-order-fetch-error.entity';
import { MlProcessedOrderItem } from './entities/ml-processed-order-item.entity';
import { MlOrdersController } from './ml-orders.controller';
import { MlOrdersProcessor } from './ml-orders.processor';
import { MlOrdersService } from './ml-orders.service';
import { MlWebhooksController } from './ml-webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MlProcessedOrderItem, MlListing, MlOrderFetchError]),
    HttpModule,
    MercadolibreModule,
    InventoryModule,
    BullModule.registerQueue({ name: 'ml-orders' }),
  ],
  controllers: [MlWebhooksController, MlOrdersController],
  providers: [MlOrdersService, MlOrdersProcessor],
})
export class MlOrdersModule {}
