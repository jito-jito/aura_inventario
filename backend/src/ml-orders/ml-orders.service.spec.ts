import { of, throwError } from 'rxjs';
import { QueryFailedError } from 'typeorm';
import { MlOrdersService } from './ml-orders.service';
import { MlListingSyncStatus } from '../ml-listings/entities/ml-listing.entity';
import { MlProcessedOrderItemStatus } from './entities/ml-processed-order-item.entity';

describe('MlOrdersService', () => {
  let service: MlOrdersService;
  let httpService: { get: jest.Mock };
  let mlAuthService: { getValidAccessToken: jest.Mock };
  let inventoryService: { registerMovement: jest.Mock };
  let processedItemsRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let listingsRepository: { findOne: jest.Mock; save: jest.Mock };
  let orderFetchErrorsRepository: { upsert: jest.Mock; delete: jest.Mock };
  let dataSourceMock: { transaction: jest.Mock };

  const singleComponentListing = {
    id: 'listing-1',
    mlItemId: 'MLA1',
    mlVariationId: null,
    syncStatus: MlListingSyncStatus.PENDING,
    lastSyncedAt: null,
    lastSyncError: null,
    components: [{ productId: 'product-1', quantityPerUnit: 1 }],
  };

  /** Cadena setLock().where().getOne() que siempre resuelve el mismo registro, sin importar el id pedido. */
  const buildLockQueryBuilder = (recordToReturn: unknown) => ({
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(recordToReturn),
  });

  /**
   * Variante que resuelve el registro según el id pedido en `.where('item.id = :id', { id })`,
   * necesaria en tests de `confirmOrderItem` con más de un hermano (cada uno abre su propia
   * transacción/query builder dentro del mismo for loop).
   */
  const buildLockQueryBuilderFor = (records: Array<{ id: string }>) => {
    let requestedId: string | undefined;
    const builder: Record<string, jest.Mock> = {};
    builder['setLock'] = jest.fn(function (this: unknown) {
      return builder;
    });
    builder['where'] = jest.fn(function (_sql: string, params: { id: string }) {
      requestedId = params.id;
      return builder;
    });
    builder['getOne'] = jest.fn(() =>
      Promise.resolve(records.find((r) => r.id === requestedId) ?? null),
    );
    return builder;
  };

  beforeEach(() => {
    httpService = { get: jest.fn() };
    mlAuthService = { getValidAccessToken: jest.fn().mockResolvedValue('token-123') };
    inventoryService = { registerMovement: jest.fn().mockResolvedValue({}) };
    processedItemsRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve(data)),
      createQueryBuilder: jest.fn(() => buildLockQueryBuilder(null)),
    };
    listingsRepository = {
      findOne: jest.fn().mockResolvedValue({ ...singleComponentListing }),
      save: jest.fn((data) => Promise.resolve(data)),
    };
    orderFetchErrorsRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    // Simula dataSource.transaction: corre el callback contra un manager cuyo
    // getRepository(MlProcessedOrderItem) es el mismo mock que processedItemsRepository,
    // así las aserciones sobre create/save/createQueryBuilder siguen valiendo igual
    // sea que el código las llame directo o vía manager dentro de una transacción.
    dataSourceMock = {
      transaction: jest.fn((cb) => cb({ getRepository: jest.fn(() => processedItemsRepository) })),
    };

    service = new MlOrdersService(
      httpService as any,
      mlAuthService as any,
      inventoryService as any,
      processedItemsRepository as any,
      listingsRepository as any,
      orderFetchErrorsRepository as any,
      dataSourceMock as any,
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

  it('registra el error y no descuenta stock si falla la consulta de la orden a Mercado Libre', async () => {
    httpService.get.mockReturnValueOnce(throwError(() => new Error('Request failed with status code 403')));

    await expect(service.processOrder('403-order')).rejects.toThrow(
      'Request failed with status code 403',
    );

    expect(orderFetchErrorsRepository.upsert).toHaveBeenCalledWith(
      { mlOrderId: '403-order', message: 'Request failed with status code 403' },
      ['mlOrderId'],
    );
    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
  });

  it('borra el error de consulta previo si la orden se puede volver a consultar con éxito', async () => {
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 112, status: 'confirmed', order_items: [] } }),
    );

    await service.processOrder('112');

    expect(orderFetchErrorsRepository.delete).toHaveBeenCalledWith({ mlOrderId: '112' });
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

  it('no vuelve a crear registros si el order-item ya fue registrado (idempotencia)', async () => {
    processedItemsRepository.find.mockResolvedValue([
      {
        id: 'existing-record',
        mlOrderId: '333',
        mlItemId: 'MLA1',
        mlVariationId: null,
        productId: 'product-1',
        quantity: 2,
        orderStatus: 'paid',
        status: MlProcessedOrderItemStatus.PENDING,
        errorMessage: null,
      },
    ]);
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 333, status: 'paid', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 2 }] } }),
    );

    await service.processOrder('333');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    expect(processedItemsRepository.save).not.toHaveBeenCalled();
  });

  it('registra la venta como pendiente sin descontar stock ni tocar el listing', async () => {
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 444, status: 'paid', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 3 }] } }),
    );

    await service.processOrder('444');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    expect(processedItemsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MlProcessedOrderItemStatus.PENDING,
        mlOrderId: '444',
        productId: 'product-1',
        quantity: 3,
      }),
    );
    expect(listingsRepository.save).not.toHaveBeenCalled();
  });

  it('si falla la inserción del registro pendiente por un error que no es de unicidad, el componente se guarda como error (no se pierde)', async () => {
    processedItemsRepository.save.mockImplementationOnce(() =>
      Promise.reject(new Error('Error de base de datos')),
    );
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 445, status: 'paid', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 1 }] } }),
    );

    await service.processOrder('445');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    expect(processedItemsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MlProcessedOrderItemStatus.ERROR,
        errorMessage: 'Error de base de datos',
        productId: 'product-1',
      }),
    );
    expect(listingsRepository.save).not.toHaveBeenCalled();
  });

  it('si otra ejecución ya registró el mismo componente (colisión de unicidad), no crea un duplicado ni toca el listing', async () => {
    const driverError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    const uniqueViolationError = new QueryFailedError(
      'INSERT INTO "ml_processed_order_items" ...',
      [],
      driverError as never,
    );
    processedItemsRepository.save.mockRejectedValueOnce(uniqueViolationError);
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 3000, status: 'paid', order_items: [{ item: { id: 'MLA1', variation_id: null }, quantity: 1 }] } }),
    );

    await service.processOrder('3000');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    expect(processedItemsRepository.save).toHaveBeenCalledTimes(1);
    expect(listingsRepository.save).not.toHaveBeenCalled();
  });

  it('un componente agregado al listing después de un primer intento no dispara un registro nuevo', async () => {
    processedItemsRepository.find.mockResolvedValue([
      {
        id: 'already-done',
        mlOrderId: '1000',
        mlItemId: 'MLA-KIT',
        mlVariationId: null,
        productId: 'lienzo-1',
        quantity: 1,
        orderStatus: 'paid',
        status: MlProcessedOrderItemStatus.PENDING,
        errorMessage: null,
      },
    ]);
    listingsRepository.findOne.mockResolvedValue({
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
    });
    httpService.get.mockReturnValueOnce(
      of({ data: { id: 1000, status: 'paid', order_items: [{ item: { id: 'MLA-KIT', variation_id: null }, quantity: 1 }] } }),
    );

    await service.processOrder('1000');

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    expect(processedItemsRepository.save).not.toHaveBeenCalled();
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

    expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    expect(processedItemsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'product-1', quantity: 1, status: MlProcessedOrderItemStatus.PENDING }),
    );
    expect(processedItemsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'product-2', quantity: 2, status: MlProcessedOrderItemStatus.PENDING }),
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

    it('registra un pendiente por cada componente, multiplicando por la cantidad vendida', async () => {
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

      expect(inventoryService.registerMovement).not.toHaveBeenCalled();
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'lienzo-1',
          quantity: 2, // 2 unidades * 1 por unidad
          status: MlProcessedOrderItemStatus.PENDING,
        }),
      );
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'marco-1',
          quantity: 8, // 2 unidades * 4 por unidad
          status: MlProcessedOrderItemStatus.PENDING,
        }),
      );
    });

    it('si falla la creación de un componente, el otro igual queda pendiente y este queda en error', async () => {
      listingsRepository.findOne.mockResolvedValue({ ...kitListing });
      processedItemsRepository.save.mockImplementation((data: { productId: string; status: string }) => {
        if (data.productId === 'marco-1' && data.status === MlProcessedOrderItemStatus.PENDING) {
          return Promise.reject(new Error('Error de base de datos'));
        }
        return Promise.resolve(data);
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

      expect(inventoryService.registerMovement).not.toHaveBeenCalled();
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'lienzo-1', status: MlProcessedOrderItemStatus.PENDING }),
      );
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'marco-1',
          status: MlProcessedOrderItemStatus.ERROR,
          errorMessage: 'Error de base de datos',
        }),
      );
    });
  });

  describe('confirmOrderItem', () => {
    const buildRecord = (overrides: Record<string, unknown> = {}) => ({
      id: 'record-1',
      mlOrderId: '2000',
      mlItemId: 'MLA1',
      mlVariationId: null,
      productId: 'product-1',
      quantity: 5,
      orderStatus: 'paid',
      status: MlProcessedOrderItemStatus.PENDING,
      errorMessage: null,
      ...overrides,
    });

    it('confirma un componente único pendiente: descuenta stock, la fila queda procesada y el listing sincronizado', async () => {
      const record = buildRecord();
      processedItemsRepository.findOne.mockResolvedValue(record);
      processedItemsRepository.find.mockResolvedValue([record]);
      processedItemsRepository.createQueryBuilder.mockReturnValue(buildLockQueryBuilder(record));

      await service.confirmOrderItem('record-1');

      expect(inventoryService.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'product-1', quantity: 5, reference: 'ml-order:2000' }),
        expect.anything(),
      );
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'record-1', status: MlProcessedOrderItemStatus.PROCESSED, errorMessage: null }),
      );
      expect(listingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ syncStatus: MlListingSyncStatus.SYNCED }),
      );
    });

    it('confirma un kit completo a partir de una sola fila: descuenta todos los componentes hermanos', async () => {
      const lienzo = buildRecord({ id: 'lienzo-record', productId: 'lienzo-1', quantity: 1 });
      const marco = buildRecord({ id: 'marco-record', productId: 'marco-1', quantity: 4 });
      processedItemsRepository.findOne.mockResolvedValue(lienzo);
      processedItemsRepository.find.mockResolvedValue([lienzo, marco]);
      processedItemsRepository.createQueryBuilder.mockImplementation(() =>
        buildLockQueryBuilderFor([lienzo, marco]),
      );

      await service.confirmOrderItem('lienzo-record');

      expect(inventoryService.registerMovement).toHaveBeenCalledTimes(2);
      expect(inventoryService.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'lienzo-1', quantity: 1 }),
        expect.anything(),
      );
      expect(inventoryService.registerMovement).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'marco-1', quantity: 4 }),
        expect.anything(),
      );
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'lienzo-record', status: MlProcessedOrderItemStatus.PROCESSED }),
      );
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'marco-record', status: MlProcessedOrderItemStatus.PROCESSED }),
      );
    });

    it('confirmar un componente pendiente también reintenta a un hermano que había quedado en error', async () => {
      const pending = buildRecord({ id: 'pending-record', productId: 'lienzo-1' });
      const errored = buildRecord({
        id: 'error-record',
        productId: 'marco-1',
        status: MlProcessedOrderItemStatus.ERROR,
        errorMessage: 'Producto no encontrado',
      });
      processedItemsRepository.findOne.mockResolvedValue(pending);
      processedItemsRepository.find.mockResolvedValue([pending, errored]);
      processedItemsRepository.createQueryBuilder.mockImplementation(() =>
        buildLockQueryBuilderFor([pending, errored]),
      );

      await service.confirmOrderItem('pending-record');

      expect(inventoryService.registerMovement).toHaveBeenCalledTimes(2);
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'error-record', status: MlProcessedOrderItemStatus.PROCESSED, errorMessage: null }),
      );
    });

    it('si un componente falla al confirmar, esa fila queda en error, las demás quedan procesadas y el listing queda en error', async () => {
      const lienzo = buildRecord({ id: 'lienzo-record', productId: 'lienzo-1' });
      const marco = buildRecord({ id: 'marco-record', productId: 'marco-1' });
      processedItemsRepository.findOne.mockResolvedValue(lienzo);
      processedItemsRepository.find.mockResolvedValue([lienzo, marco]);
      processedItemsRepository.createQueryBuilder.mockImplementation(() =>
        buildLockQueryBuilderFor([lienzo, marco]),
      );
      inventoryService.registerMovement.mockImplementation(({ productId }: { productId: string }) =>
        productId === 'marco-1'
          ? Promise.reject(new Error('Stock insuficiente'))
          : Promise.resolve({}),
      );

      await service.confirmOrderItem('lienzo-record');

      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'lienzo-record', status: MlProcessedOrderItemStatus.PROCESSED }),
      );
      expect(processedItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'marco-record',
          status: MlProcessedOrderItemStatus.ERROR,
          errorMessage: 'Stock insuficiente',
        }),
      );
      expect(listingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ syncStatus: MlListingSyncStatus.ERROR }),
      );
    });

    it('lanza NotFoundException si el id no existe', async () => {
      processedItemsRepository.findOne.mockResolvedValue(null);

      await expect(service.confirmOrderItem('missing')).rejects.toThrow('Registro no encontrado');
      expect(inventoryService.registerMovement).not.toHaveBeenCalled();
    });

    it('si todo el grupo ya está procesado, no hace nada (no descuenta de nuevo ni toca el listing)', async () => {
      const processed = buildRecord({ status: MlProcessedOrderItemStatus.PROCESSED, errorMessage: null });
      processedItemsRepository.findOne.mockResolvedValue(processed);
      processedItemsRepository.find.mockResolvedValue([processed]);

      await service.confirmOrderItem('record-1');

      expect(inventoryService.registerMovement).not.toHaveBeenCalled();
      expect(processedItemsRepository.save).not.toHaveBeenCalled();
      expect(listingsRepository.findOne).not.toHaveBeenCalled();
      expect(listingsRepository.save).not.toHaveBeenCalled();
    });

    it('si el lock ve que otra ejecución ya resolvió el componente concurrentemente, no lo vuelve a procesar', async () => {
      const record = buildRecord();
      const resolvedConcurrently = { ...record, status: MlProcessedOrderItemStatus.PROCESSED };
      processedItemsRepository.findOne.mockResolvedValue(record);
      processedItemsRepository.find.mockResolvedValue([record]);
      processedItemsRepository.createQueryBuilder.mockReturnValue(buildLockQueryBuilder(resolvedConcurrently));

      await service.confirmOrderItem('record-1');

      expect(inventoryService.registerMovement).not.toHaveBeenCalled();
      expect(listingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ syncStatus: MlListingSyncStatus.SYNCED }),
      );
    });

    it('si el listing ya no existe, la confirmación no falla y simplemente no actualiza syncStatus', async () => {
      const record = buildRecord();
      processedItemsRepository.findOne.mockResolvedValue(record);
      processedItemsRepository.find.mockResolvedValue([record]);
      processedItemsRepository.createQueryBuilder.mockReturnValue(buildLockQueryBuilder(record));
      listingsRepository.findOne.mockResolvedValue(null);

      await expect(service.confirmOrderItem('record-1')).resolves.not.toThrow();

      expect(inventoryService.registerMovement).toHaveBeenCalled();
      expect(listingsRepository.save).not.toHaveBeenCalled();
    });
  });
});
