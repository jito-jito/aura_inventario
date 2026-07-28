import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MlConnection, MlConnectionStatus } from '../mercadolibre/entities/ml-connection.entity';
import { MlListing, MlListingSyncStatus } from '../ml-listings/entities/ml-listing.entity';
import {
  MlProcessedOrderItem,
  MlProcessedOrderItemStatus,
} from '../ml-orders/entities/ml-processed-order-item.entity';

export type IntegrationErrorType = 'ml_connection' | 'ml_listing' | 'order_processing';

export interface IntegrationErrorItem {
  type: IntegrationErrorType;
  message: string;
  context: string;
  occurredAt: string;
}

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(MlConnection) private readonly connectionRepository: Repository<MlConnection>,
    @InjectRepository(MlListing) private readonly listingsRepository: Repository<MlListing>,
    @InjectRepository(MlProcessedOrderItem)
    private readonly processedItemsRepository: Repository<MlProcessedOrderItem>,
  ) {}

  async getErrors(limit = 50): Promise<IntegrationErrorItem[]> {
    const [connectionsInError, listingsInError, orderItemsInError] = await Promise.all([
      this.connectionRepository.find({ where: { status: MlConnectionStatus.ERROR } }),
      this.listingsRepository.find({
        where: { syncStatus: MlListingSyncStatus.ERROR },
        relations: { components: { product: true } },
      }),
      this.processedItemsRepository.find({
        where: { status: MlProcessedOrderItemStatus.ERROR },
        relations: { product: true },
      }),
    ]);

    const errors: IntegrationErrorItem[] = [
      ...connectionsInError.map((connection) => ({
        type: 'ml_connection' as const,
        message: connection.lastError ?? 'Error de conexión con Mercado Libre',
        context: 'Conexión Mercado Libre',
        occurredAt: connection.updatedAt.toISOString(),
      })),
      ...listingsInError.map((listing) => ({
        type: 'ml_listing' as const,
        message: listing.lastSyncError ?? 'Error al procesar la publicación vinculada',
        context: `${listing.components.map((c) => `${c.product.name} (${c.product.sku})`).join(' + ')} · ${listing.mlItemId}`,
        occurredAt: listing.updatedAt.toISOString(),
      })),
      ...orderItemsInError.map((item) => ({
        type: 'order_processing' as const,
        message: item.errorMessage ?? 'Error al procesar la venta',
        context: `Orden ML ${item.mlOrderId} · ${item.product.name} (${item.product.sku})`,
        occurredAt: item.processedAt.toISOString(),
      })),
    ];

    return errors
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, limit);
  }
}
