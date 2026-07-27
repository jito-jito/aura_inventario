import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { IsNull, Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { MovementType } from '../inventory/entities/inventory-movement.entity';
import { MlAuthService } from '../mercadolibre/ml-auth.service';
import { MlListing, MlListingSyncStatus } from '../ml-listings/entities/ml-listing.entity';
import {
  MlProcessedOrderItem,
  MlProcessedOrderItemStatus,
} from './entities/ml-processed-order-item.entity';

interface MlOrderItem {
  item: {
    id: string;
    variation_id: number | string | null;
  };
  quantity: number;
}

interface MlOrder {
  id: number;
  status: string;
  order_items: MlOrderItem[];
}

/** Estados de orden en los que corresponde descontar stock (venta confirmada). */
const CONSUMPTION_STATUSES = ['paid'];

@Injectable()
export class MlOrdersService {
  private readonly logger = new Logger(MlOrdersService.name);

  constructor(
    private readonly http: HttpService,
    private readonly mlAuthService: MlAuthService,
    private readonly inventoryService: InventoryService,
    @InjectRepository(MlProcessedOrderItem)
    private readonly processedItemsRepository: Repository<MlProcessedOrderItem>,
    @InjectRepository(MlListing) private readonly listingsRepository: Repository<MlListing>,
  ) {}

  private async fetchOrder(orderId: string): Promise<MlOrder> {
    const accessToken = await this.mlAuthService.getValidAccessToken();
    const response = await firstValueFrom(
      this.http.get<MlOrder>(`https://api.mercadolibre.com/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return response.data;
  }

  async processOrder(orderId: string): Promise<void> {
    const order = await this.fetchOrder(orderId);

    if (!CONSUMPTION_STATUSES.includes(order.status)) {
      this.logger.log(
        `Orden ${orderId} en estado "${order.status}", todavía no corresponde descontar stock`,
      );
      return;
    }

    for (const orderItem of order.order_items) {
      await this.processOrderItem(order, orderItem);
    }
  }

  private async processOrderItem(order: MlOrder, orderItem: MlOrderItem): Promise<void> {
    const mlItemId = orderItem.item.id;
    const mlVariationId =
      orderItem.item.variation_id !== null && orderItem.item.variation_id !== undefined
        ? String(orderItem.item.variation_id)
        : null;

    const alreadyProcessed = await this.processedItemsRepository.findOne({
      where: {
        mlOrderId: String(order.id),
        mlItemId,
        mlVariationId: mlVariationId ?? IsNull(),
      },
    });
    if (alreadyProcessed) {
      this.logger.log(`Orden ${order.id}, item ${mlItemId} ya había sido procesado; se ignora`);
      return;
    }

    const listing = await this.listingsRepository.findOne({
      where: { mlItemId, mlVariationId: mlVariationId ?? IsNull() },
    });
    if (!listing) {
      this.logger.warn(
        `Publicación ${mlItemId}${mlVariationId ? '/' + mlVariationId : ''} no está vinculada a ningún producto; se ignora la venta`,
      );
      return;
    }

    const record = this.processedItemsRepository.create({
      mlOrderId: String(order.id),
      mlItemId,
      mlVariationId,
      productId: listing.productId,
      quantity: orderItem.quantity,
      orderStatus: order.status,
    });

    try {
      await this.inventoryService.registerMovement({
        productId: listing.productId,
        type: MovementType.OUT,
        quantity: orderItem.quantity,
        reason: 'Venta Mercado Libre',
        reference: `ml-order:${order.id}`,
      });

      record.status = MlProcessedOrderItemStatus.PROCESSED;
      listing.syncStatus = MlListingSyncStatus.SYNCED;
      listing.lastSyncedAt = new Date();
      listing.lastSyncError = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(
        `No se pudo descontar stock por la orden ${order.id}, item ${mlItemId}: ${message}`,
      );
      record.status = MlProcessedOrderItemStatus.ERROR;
      record.errorMessage = message;
      listing.syncStatus = MlListingSyncStatus.ERROR;
      listing.lastSyncError = message;
    }

    await this.processedItemsRepository.save(record);
    await this.listingsRepository.save(listing);
  }

  findRecentlyProcessed(limit = 50): Promise<MlProcessedOrderItem[]> {
    return this.processedItemsRepository.find({
      relations: { product: true },
      order: { processedAt: 'DESC' },
      take: limit,
    });
  }
}
