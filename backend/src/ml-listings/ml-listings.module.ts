import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MercadolibreModule } from '../mercadolibre/mercadolibre.module';
import { Product } from '../products/entities/product.entity';
import { MlListing } from './entities/ml-listing.entity';
import { MlListingsController } from './ml-listings.controller';
import { MlListingsService } from './ml-listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([MlListing, Product]), HttpModule, MercadolibreModule],
  controllers: [MlListingsController],
  providers: [MlListingsService],
})
export class MlListingsModule {}
