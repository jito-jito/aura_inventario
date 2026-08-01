import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { MercadolibreModule } from './mercadolibre/mercadolibre.module';
import { MlListingsModule } from './ml-listings/ml-listings.module';
import { MlOrdersModule } from './ml-orders/ml-orders.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { BackupModule } from './backups/backup.module';
import { ProjectionsModule } from './projections/projections.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'aura'),
        password: config.get<string>('DB_PASSWORD', 'aura'),
        database: config.get<string>('DB_NAME', 'aura_inventario'),
        autoLoadEntities: true,
        synchronize:
          config.get<string>('NODE_ENV', 'development') !== 'production',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun:
          config.get<string>('NODE_ENV', 'development') === 'production',
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    AuthModule,
    ProductsModule,
    InventoryModule,
    MercadolibreModule,
    MlListingsModule,
    MlOrdersModule,
    MonitoringModule,
    BackupModule,
    ProjectionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
