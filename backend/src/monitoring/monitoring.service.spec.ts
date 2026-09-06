import { MonitoringService } from './monitoring.service';
import { MlConnectionStatus } from '../mercadolibre/entities/ml-connection.entity';
import { MlListingSyncStatus } from '../ml-listings/entities/ml-listing.entity';
import { MlProcessedOrderItemStatus } from '../ml-orders/entities/ml-processed-order-item.entity';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let connectionRepository: { find: jest.Mock };
  let listingsRepository: { find: jest.Mock };
  let processedItemsRepository: { find: jest.Mock };
  let orderFetchErrorsRepository: { find: jest.Mock };

  beforeEach(() => {
    connectionRepository = { find: jest.fn().mockResolvedValue([]) };
    listingsRepository = { find: jest.fn().mockResolvedValue([]) };
    processedItemsRepository = { find: jest.fn().mockResolvedValue([]) };
    orderFetchErrorsRepository = { find: jest.fn().mockResolvedValue([]) };

    service = new MonitoringService(
      connectionRepository as any,
      listingsRepository as any,
      processedItemsRepository as any,
      orderFetchErrorsRepository as any,
    );
  });

  it('devuelve una lista vacía si no hay errores', async () => {
    await expect(service.getErrors()).resolves.toEqual([]);
  });

  it('consulta cada repositorio filtrando solo por estado de error', async () => {
    await service.getErrors();

    expect(connectionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: MlConnectionStatus.ERROR } }),
    );
    expect(listingsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { syncStatus: MlListingSyncStatus.ERROR } }),
    );
    expect(processedItemsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: MlProcessedOrderItemStatus.ERROR } }),
    );
    expect(orderFetchErrorsRepository.find).toHaveBeenCalled();
  });

  it('combina y ordena los cuatro tipos de error por fecha, más reciente primero', async () => {
    connectionRepository.find.mockResolvedValue([
      { lastError: 'Token inválido', updatedAt: new Date('2026-01-01T00:00:00Z') },
    ]);
    listingsRepository.find.mockResolvedValue([
      {
        lastSyncError: 'Timeout',
        mlItemId: 'MLA1',
        components: [{ product: { name: 'Producto A', sku: 'A-1' } }],
        updatedAt: new Date('2026-01-03T00:00:00Z'),
      },
    ]);
    processedItemsRepository.find.mockResolvedValue([
      {
        errorMessage: 'Stock insuficiente',
        mlOrderId: '123',
        product: { name: 'Producto B', sku: 'B-1' },
        processedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ]);
    orderFetchErrorsRepository.find.mockResolvedValue([
      {
        mlOrderId: '456',
        message: 'Request failed with status code 403',
        updatedAt: new Date('2026-01-04T00:00:00Z'),
      },
    ]);

    const errors = await service.getErrors();

    expect(errors.map((e) => e.type)).toEqual([
      'order_fetch',
      'ml_listing',
      'order_processing',
      'ml_connection',
    ]);
    expect(errors[0]).toMatchObject({
      message: 'Request failed with status code 403',
      context: 'Orden ML 456',
    });
    expect(errors[1]).toMatchObject({ message: 'Timeout', context: 'Producto A (A-1) · MLA1' });
    expect(errors[2]).toMatchObject({
      message: 'Stock insuficiente',
      context: 'Orden ML 123 · Producto B (B-1)',
    });
  });

  it('respeta el límite pasado', async () => {
    connectionRepository.find.mockResolvedValue([
      { lastError: 'e1', updatedAt: new Date('2026-01-01') },
      { lastError: 'e2', updatedAt: new Date('2026-01-02') },
      { lastError: 'e3', updatedAt: new Date('2026-01-03') },
    ]);

    const errors = await service.getErrors(2);

    expect(errors).toHaveLength(2);
    expect(errors[0].message).toBe('e3');
  });
});
