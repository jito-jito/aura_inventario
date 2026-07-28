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

  const singleComponentListing = {
    id: 'listing-1',
    mlItemId: 'MLA1',
    mlVariationId: null,
    syncStatus: MlListingSyncStatus.PENDING,
    lastSyncedAt: null,
    lastSyncError: null,
    components: [{ productId: 'product-1', quantityPerUnit: 1 }],
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
      findOne: jest.fn().mockResolvedValue({ ...singleComponentListing }),
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

  it('ignora una publicación vinculada sin ningún componente', async () => {
    listingsRepository.findOne.mockResolvedValue({ ...singleComponentListing, components: [] });
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 223, status: 'paid', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 1 }] } }),
    );

    await service.processOrder('223');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
  });

  it('no vuelve a procesar un componente ya registrado (idempotencia)', async () => {
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
      expect.objectContaining({ syncStatus: MlListingSyncStatus.ERROR }),
    );
  });

  it('procesa cada item de la orden de forma independiente', async () => {
    listingsRepository.findOne
      .mockResolvedValueOnce({
        ...singleComponentListing,
        id: 'listing-1',
        components: [{ productId: 'product-1', quantityPerUnit: 1 }],
      })
      .mockResolvedValueOnce({
        ...singleComponentListing,
        id: 'listing-2',
        mlItemId: 'MLA2',
        components: [{ productId: 'product-2', quantityPerUnit: 1 }],
      });
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

  describe('publicaciones con varios componentes (kit)', () => {
    const kitListing = {
      id: 'listing-kit',
      mlItemId: 'MLA-KIT',
      mlVariationId: null,
      syncStatus: MlListingSyncStatus.PENDING,
      lastSyncedAt: null,
      lastSyncError: null,
      components: [
        { productId: 'lienzo-1', quantityPerUnit: 1 },
        { productId: 'marco-1', quantityPerUnit: 4 },
      ],
    };

    it('descuenta stock de todos los componentes, multiplicando por la cantidad vendida', async () => {
      listingsRepository.findOne.mockResolvedValue({ ...kitListing });
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            id: 888,
            status: 'paid',
            order_items: [{ item: { id: 'MLA-KIT', variation_id: null }, quantity: 2 }],
          },
        }),
      );

      await service.processOrder('888');

      expect(inventoryService.registerMovement).toHaveBeenCalledTimes(2);
      expect(inventoryService.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'lienzo-1', quantity: 2 }), // 2 unidades * 1 por unidad
      );
      expect(inventoryService.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'marco-1', quantity: 8 }), // 2 unidades * 4 por unidad
      );
    });

    it('si un componente falla, el otro igual se descuenta y la publicación queda en error', async () => {
      listingsRepository.findOne.mockResolvedValue({ ...kitListing });
      inventoryService.registerMovement.mockImplementation(({ productId }: { productId: string }) => {
        if (productId === 'marco-1') {
          return Promise.reject(new Error('Stock insuficiente de marcos'));
        }
        return Promise.resolve({});
      });
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            id: 999,
            status: 'paid',
            order_items: [{ item: { id: 'MLA-KIT', variation_id: null }, quantity: 1 }],
          },
        }),
      );

      await service.processOrder('999');

      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'lienzo-1', status: MlProcessedOrderItemStatus.PROCESSED }),
      );
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'marco-1', status: MlProcessedOrderItemStatus.ERROR }),
      );
      expect(listingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ syncStatus: MlListingSyncStatus.ERROR }),
      );
    });

    it('no reprocesa un componente ya registrado pero sí uno nuevo (idempotencia parcial)', async () => {
      processedItemsRepository.findOne.mockImplementation(({ where }: any) =>
        Promise.resolve(where.productId === 'lienzo-1' ? { id: 'already-done' } : null),
      );
      listingsRepository.findOne.mockResolvedValue({ ...kitListing });
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            id: 1000,
            status: 'paid',
            order_items: [{ item: { id: 'MLA-KIT', variation_id: null }, quantity: 1 }],
          },
        }),
      );

      await service.processOrder('1000');

      expect(inventoryService.registerMovement).toHaveBeenCalledTimes(1);
      expect(inventoryService.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'marco-1' }),
      );
    });
  });
});
