import { of } from 'rxjs';
import { MlOrdersService } from './ml-orders.service';
import { MlListingSyncStatus } from '../ml-listings/entities/ml-listing.entity';
import { MlProcessedOrderItemStatus } from './entities/ml-processed-order-item.entity';

describe('MlOrdersService', () => {
  let service: MlOrdersService;
  let httpService: { get: jest.Mock };
  let mlAuthService: { getValidAccessToken: jest.Mock };
  let inventoryService: { registerMovement: jest.Mock };
  let processedItemsRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let listingsRepository: { findOne: jest.Mock; save: jest.Mock };

  const listing = {
    id: 'listing-1',
    productId: 'product-1',
    mlItemId: 'MLA1',
    mlVariationId: null,
    syncStatus: MlListingSyncStatus.PENDING,
    lastSyncedAt: null,
    lastSyncError: null,
  };

  beforeEach(() => {
    httpService = { get: jest.fn() };
    mlAuthService = { getValidAccessToken: jest.fn().mockResolvedValue('token-123') };
    inventoryService = { registerMovement: jest.fn().mockResolvedValue({}) };
    processedItemsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve(data)),
      find: jest.fn().mockResolvedValue([]),
    };
    listingsRepository = {
      findOne: jest.fn().mockResolvedValue({ ...listing }),
      save: jest.fn((data) => Promise.resolve(data)),
    };

    service = new MlOrdersService(
      httpService as any,
      mlAuthService as any,
      inventoryService as any,
      processedItemsRepository as any,
      listingsRepository as any,
    );
  });

  it('no hace nada si la orden todavía no está pagada', async () => {
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 111, status: 'confirmed', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 1 }] } }),
    );

    await service.processOrder('111');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    expect(processedItemsRepository.save).not.toHaveBeenCalled();
  });

  it('ignora un item cuya publicación no está vinculada a ningún producto', async () => {
    listingsRepository.findOne.mockResolvedValue(null);
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 222, status: 'paid', order_items: [{ item: { id: 'MLA-NOLINK', variation_id: null }, quantity: 1 }] } }),
    );

    await service.processOrder('222');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    expect(processedItemsRepository.save).not.toHaveBeenCalled();
  });

  it('no vuelve a procesar un item ya registrado (idempotencia)', async () => {
    processedItemsRepository.findOne.mockResolvedValue({ id: 'existing-record' });
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 333, status: 'paid', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 2 }] } }),
    );

    await service.processOrder('333');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
  });

  it('descuenta stock y marca el registro como procesado', async () => {
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 444, status: 'paid', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 3 }] } }),
    );

    await service.processOrder('444');

    expect(inventoryService.registerMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        type: 'out',
        quantity: 3,
        reference: 'ml-order:444',
      }),
    );
    expect(processedItemsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: MlProcessedOrderItemStatus.PROCESSED, mlOrderId: '444' }),
    );
    expect(listingsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ syncStatus: MlListingSyncStatus.SYNCED }),
    );
  });

  it('registra el error si el descuento de stock falla (por ejemplo, stock insuficiente)', async () => {
    inventoryService.registerMovement.mockRejectedValue(new Error('Stock insuficiente'));
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 555, status: 'paid', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 1 }] } }),
    );

    await service.processOrder('555');

    expect(processedItemsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MlProcessedOrderItemStatus.ERROR,
        errorMessage: 'Stock insuficiente',
      }),
    );
    expect(listingsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ syncStatus: MlListingSyncStatus.ERROR, lastSyncError: 'Stock insuficiente' }),
    );
  });

  it('procesa cada item de la orden de forma independiente', async () => {
    listingsRepository.findOne
      .mockResolvedValueOnce({ ...listing, id: 'listing-1', productId: 'product-1' })
      .mockResolvedValueOnce({ ...listing, id: 'listing-2', productId: 'product-2', mlItemId: 'MLA2' });
    httpService.get.mockReturnValueOnce(
      of({
        data: {
          id: 666,
          status: 'paid',
          order_items: [
            { item: { id: 'MLA1', variation_id: null }, quantity: 1 },
            { item: { id: 'MLA2', variation_id: null }, quantity: 2 },
          ],
        },
      }),
    );

    await service.processOrder('666');

    expect(inventoryService.registerMovement).toHaveBeenCalledTimes(2);
    expect(inventoryService.registerMovement).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ productId: 'product-1', quantity: 1 }),
    );
    expect(inventoryService.registerMovement).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ productId: 'product-2', quantity: 2 }),
    );
  });

  it('usa el access_token vigente para consultar la orden', async () => {
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 777, status: 'confirmed', order_items: [] } }),
    );

    await service.processOrder('777');

    expect(mlAuthService.getValidAccessToken).toHaveBeenCalled();
    expect(httpService.get).toHaveBeenCalledWith(
      'https://api.mercadolibre.com/orders/777',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-123' } }),
    );
  });
});
