import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module';
import { MlProcessedOrderItem } from '../ml-orders/entities/ml-processed-order-item.entity';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, MlProcessedOrderItem]), InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
