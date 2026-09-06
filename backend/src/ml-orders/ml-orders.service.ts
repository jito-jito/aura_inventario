import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { IsNull, Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { MovementType } from '../inventory/entities/inventory-movement.entity';
import { MlAuthService } from '../mercadolibre/ml-auth.service';
import { MlListing, MlListingSyncStatus } from '../ml-listings/entities/ml-listing.entity';
import { MlOrderFetchError } from './entities/ml-order-fetch-error.entity';
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
    @InjectRepository(MlOrderFetchError)
    private readonly orderFetchErrorsRepository: Repository<MlOrderFetchError>,
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

  /** Extrae el detalle que manda Mercado Libre en el cuerpo del error (además del status HTTP). */
  private describeFetchError(err: unknown): string {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      const detail = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined;
      return [status ? `HTTP ${status}` : err.message, detail].filter(Boolean).join(' — ');
    }
    return err instanceof Error ? err.message : 'Error desconocido';
  }

  async processOrder(orderId: string): Promise<void> {
    let order: MlOrder;
    try {
      order = await this.fetchOrder(orderId);
    } catch (err) {
      const message = this.describeFetchError(err);
      this.logger.error(`No se pudo consultar la orden ${orderId} en Mercado Libre: ${message}`);
      await this.orderFetchErrorsRepository.upsert({ mlOrderId: orderId, message }, ['mlOrderId']);
      throw err;
    }
    await this.orderFetchErrorsRepository.delete({ mlOrderId: orderId });

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

  /**
   * Una publicación puede componerse de varios productos internos (kit): por
   * ejemplo, una publicación de "cuadro" que consume un lienzo y un marco por
   * unidad vendida. Cada componente se descuenta y se registra por separado,
   * así una falla en uno (ej. stock insuficiente del marco) no bloquea a los
   * demás (el lienzo sí se descuenta).
   */
  private async processOrderItem(order: MlOrder, orderItem: MlOrderItem): Promise<void> {
    const mlItemId = orderItem.item.id;
    const mlVariationId =
      orderItem.item.variation_id !== null && orderItem.item.variation_id !== undefined
        ? String(orderItem.item.variation_id)
        : null;

    const listing = await this.listingsRepository.findOne({
      where: { mlItemId, mlVariationId: mlVariationId ?? IsNull() },
      relations: { components: true },
    });
    if (!listing || listing.components.length === 0) {
      this.logger.warn(
        `Publicación ${mlItemId}${mlVariationId ? '/' + mlVariationId : ''} no está vinculada a ningún producto; se ignora la venta`,
      );
      return;
    }

    let anyError = false;
    let allAlreadyProcessed = true;

    for (const component of listing.components) {
      const alreadyProcessed = await this.processedItemsRepository.findOne({
        where: {
          mlOrderId: String(order.id),
          mlItemId,
          mlVariationId: mlVariationId ?? IsNull(),
          productId: component.productId,
        },
      });
      if (alreadyProcessed) {
        continue;
      }
      allAlreadyProcessed = false;

      const quantity = orderItem.quantity * component.quantityPerUnit;
      const record = this.processedItemsRepository.create({
        mlOrderId: String(order.id),
        mlItemId,
        mlVariationId,
        productId: component.productId,
        quantity,
        orderStatus: order.status,
      });

      try {
        await this.inventoryService.registerMovement({
          productId: component.productId,
          type: MovementType.OUT,
          quantity,
          reason: 'Venta Mercado Libre',
          reference: `ml-order:${order.id}`,
        });
        record.status = MlProcessedOrderItemStatus.PROCESSED;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        this.logger.error(
          `No se pudo descontar stock por la orden ${order.id}, item ${mlItemId}, producto ${component.productId}: ${message}`,
        );
        record.status = MlProcessedOrderItemStatus.ERROR;
        record.errorMessage = message;
        anyError = true;
      }

      await this.processedItemsRepository.save(record);
    }

    if (allAlreadyProcessed) {
      this.logger.log(`Orden ${order.id}, item ${mlItemId} ya había sido procesado; se ignora`);
      return;
    }

    listing.syncStatus = anyError ? MlListingSyncStatus.ERROR : MlListingSyncStatus.SYNCED;
    listing.lastSyncedAt = new Date();
    listing.lastSyncError = anyError
      ? 'No se pudo descontar el stock de algún componente de esta publicación; revisar el detalle en ventas recientes'
      : null;
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
