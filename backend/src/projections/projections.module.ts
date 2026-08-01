import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MlProcessedOrderItem } from '../ml-orders/entities/ml-processed-order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProjectionPeriod } from './entities/projection-period.entity';
import { ProjectionScenario } from './entities/projection-scenario.entity';
import { ProjectionsController } from './projections.controller';
import { ProjectionsService } from './projections.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectionScenario, ProjectionPeriod, Product, MlProcessedOrderItem]),
  ],
  controllers: [ProjectionsController],
  providers: [ProjectionsService],
})
export class ProjectionsModule {}
