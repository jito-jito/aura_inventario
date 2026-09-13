import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { DataSource, IsNull, QueryFailedError, Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { MovementType } from '../inventory/entities/inventory-movement.entity';
import { MlAuthService } from '../mercadolibre/ml-auth.service';
import { MlListing, MlListingSyncStatus } from '../ml-listings/entities/ml-listing.entity';
import { QueryProcessedOrdersDto } from './dto/query-processed-orders.dto';
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
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private async fetchOrder(orderId: string): Promise<MlOrder> {
    const accessToken = await this.mlAuthService.getValidAccessToken();
    const response = await firstValueFrom(
      this.http.get<MlOrder>(`https://api.mercadolibre.com/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      }),
    );
    return response.data;
  }

  private isUniqueViolation(err: unknown): boolean {
    return err instanceof QueryFailedError && (err as unknown as { code?: string }).code === '23505';
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
   * unidad vendida. Cada componente queda como un registro independiente.
   *
   * El stock NO se descuenta acá: cada componente llega como `pending` y
   * queda a la espera de que alguien lo confirme manualmente desde la
   * pantalla de Ventas (`confirmOrderItem`), donde recién se descuenta stock.
   *
   * Idempotencia: se chequea primero si este order-item (orden+item+variación,
   * sin importar producto) ya tuvo algún intento. Si lo tuvo, NUNCA se vuelve a
   * consultar la composición actual del listing ni se crea nada nuevo — evita
   * que un cambio posterior en el vínculo publicación↔producto, o una reentrega
   * del webhook, generen registros duplicados para una venta ya vista. Cualquier
   * reintento de un componente en error también es manual, vía `confirmOrderItem`.
   */
  private async processOrderItem(order: MlOrder, orderItem: MlOrderItem): Promise<void> {
    const mlItemId = orderItem.item.id;
    const mlVariationId =
      orderItem.item.variation_id !== null && orderItem.item.variation_id !== undefined
        ? String(orderItem.item.variation_id)
        : null;

    const existingRecords = await this.processedItemsRepository.find({
      where: { mlOrderId: String(order.id), mlItemId, mlVariationId: mlVariationId ?? IsNull() },
    });

    if (existingRecords.length > 0) {
      this.logger.log(`Orden ${order.id}, item ${mlItemId} ya había sido registrado; se ignora`);
      return;
    }

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

    for (const component of listing.components) {
      const quantity = orderItem.quantity * component.quantityPerUnit;

      try {
        // Reserva atómica del slot de idempotencia: si otra ejecución ya insertó
        // esta misma fila, el UNIQUE de la base lanza 23505.
        await this.processedItemsRepository.save(
          this.processedItemsRepository.create({
            mlOrderId: String(order.id),
            mlItemId,
            mlVariationId,
            productId: component.productId,
            quantity,
            orderStatus: order.status,
            status: MlProcessedOrderItemStatus.PENDING,
            errorMessage: null,
          }),
        );
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          continue;
        }
        const message = err instanceof Error ? err.message : 'Error desconocido';
        this.logger.error(
          `No se pudo registrar como pendiente la orden ${order.id}, item ${mlItemId}, producto ${component.productId}: ${message}`,
        );
        await this.processedItemsRepository.save(
          this.processedItemsRepository.create({
            mlOrderId: String(order.id),
            mlItemId,
            mlVariationId,
            productId: component.productId,
            quantity,
            orderStatus: order.status,
            status: MlProcessedOrderItemStatus.ERROR,
            errorMessage: message,
          }),
        );
      }
    }
  }

  /**
   * Confirma manualmente un order-item completo: descuenta stock de todos sus
   * componentes juntos (si la publicación es un kit, todos a la vez), sin
   * importar si venían `pending` (primera confirmación) o `error` (reintento).
   * `id` es el id de cualquiera de las filas del grupo — se resuelven todas
   * las que comparten (mlOrderId, mlItemId, mlVariationId).
   */
  async confirmOrderItem(id: string): Promise<void> {
    const record = await this.processedItemsRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Registro no encontrado');
    }

    const siblings = await this.processedItemsRepository.find({
      where: {
        mlOrderId: record.mlOrderId,
        mlItemId: record.mlItemId,
        mlVariationId: record.mlVariationId ?? IsNull(),
      },
    });
    const actionable = siblings.filter(
      (r) =>
        r.status === MlProcessedOrderItemStatus.PENDING || r.status === MlProcessedOrderItemStatus.ERROR,
    );
    if (actionable.length === 0) {
      return;
    }

    let anyError = false;

    for (const sibling of actionable) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const repo = manager.getRepository(MlProcessedOrderItem);
          const locked = await repo
            .createQueryBuilder('item')
            .setLock('pessimistic_write')
            .where('item.id = :id', { id: sibling.id })
            .getOne();

          if (
            !locked ||
            (locked.status !== MlProcessedOrderItemStatus.PENDING &&
              locked.status !== MlProcessedOrderItemStatus.ERROR)
          ) {
            return; // otra ejecución concurrente ya lo resolvió
          }

          await this.inventoryService.registerMovement(
            {
              productId: locked.productId,
              type: MovementType.OUT,
              quantity: locked.quantity,
              reason: 'Venta Mercado Libre',
              reference: `ml-order:${locked.mlOrderId}`,
            },
            manager,
          );
          locked.status = MlProcessedOrderItemStatus.PROCESSED;
          locked.errorMessage = null;
          await repo.save(locked);
        });
      } catch (err) {
        anyError = true;
        const message = err instanceof Error ? err.message : 'Error desconocido';
        this.logger.error(
          `No se pudo confirmar la orden ${sibling.mlOrderId}, item ${sibling.mlItemId}, producto ${sibling.productId}: ${message}`,
        );
        sibling.status = MlProcessedOrderItemStatus.ERROR;
        sibling.errorMessage = message;
        await this.processedItemsRepository.save(sibling);
      }
    }

    const listing = await this.listingsRepository.findOne({
      where: { mlItemId: record.mlItemId, mlVariationId: record.mlVariationId ?? IsNull() },
    });
    await this.updateListingSyncStatus(listing, anyError);
  }

  private async updateListingSyncStatus(listing: MlListing | null, anyError: boolean): Promise<void> {
    if (!listing) return;

    listing.syncStatus = anyError ? MlListingSyncStatus.ERROR : MlListingSyncStatus.SYNCED;
    listing.lastSyncedAt = new Date();
    listing.lastSyncError = anyError
      ? 'No se pudo descontar el stock de algún componente de esta publicación; revisar el detalle en ventas recientes'
      : null;
    await this.listingsRepository.save(listing);
  }

  findProcessed(filters: QueryProcessedOrdersDto = {}): Promise<MlProcessedOrderItem[]> {
    const qb = this.processedItemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .orderBy('item.processedAt', 'DESC');

    if (filters.dateFrom) {
      qb.andWhere('item.processedAt >= :dateFrom', {
        dateFrom: new Date(`${filters.dateFrom}T00:00:00.000Z`),
      });
    }
    if (filters.dateTo) {
      qb.andWhere('item.processedAt <= :dateTo', {
        dateTo: new Date(`${filters.dateTo}T23:59:59.999Z`),
      });
    }
    if (filters.status) {
      qb.andWhere('item.status = :status', { status: filters.status });
    }
    if (filters.search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR item.mlOrderId ILIKE :search OR item.mlItemId ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return qb.getMany();
  }
}
