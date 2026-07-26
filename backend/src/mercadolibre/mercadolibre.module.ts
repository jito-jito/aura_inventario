import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MlConnection } from './entities/ml-connection.entity';
import { MlAuthController } from './ml-auth.controller';
import { MlAuthService } from './ml-auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([MlConnection]), HttpModule],
  controllers: [MlAuthController],
  providers: [MlAuthService],
  exports: [MlAuthService],
})
export class MercadolibreModule {}
