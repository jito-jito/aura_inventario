import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryService } from '../inventory/inventory.service';
import {
  MlProcessedOrderItem,
  MlProcessedOrderItemStatus,
} from '../ml-orders/entities/ml-processed-order-item.entity';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

describe('ProductsService — stock proyectado', () => {
  let service: ProductsService;
  let productsRepository: { find: jest.Mock };
  let processedItemsRepository: { find: jest.Mock };

  const buildProduct = (overrides: Partial<Product>): Product =>
    ({
      id: 'product-1',
      sku: 'SKU-1',
      name: 'Producto',
      description: null,
      cost: '10.00',
      stock: 10,
      minStock: 5,
      movements: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Product;

  beforeEach(async () => {
    productsRepository = { find: jest.fn() };
    processedItemsRepository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productsRepository },
        {
          provide: getRepositoryToken(MlProcessedOrderItem),
          useValue: processedItemsRepository,
        },
        { provide: InventoryService, useValue: {} },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('projectedStock === stock cuando no hay ventas pendientes', async () => {
    productsRepository.find.mockResolvedValue([buildProduct({ stock: 10 })]);
    processedItemsRepository.find.mockResolvedValue([]);

    const [product] = await service.findAll({});

    expect(product.projectedStock).toBe(10);
  });

  it('resta la cantidad de un item pending', async () => {
    productsRepository.find.mockResolvedValue([buildProduct({ stock: 10 })]);
    processedItemsRepository.find.mockResolvedValue([
      { productId: 'product-1', quantity: 3 },
    ]);

    const [product] = await service.findAll({});

    expect(product.projectedStock).toBe(7);
  });

  it('no resta items en estado error', async () => {
    productsRepository.find.mockResolvedValue([buildProduct({ stock: 10 })]);
    processedItemsRepository.find.mockResolvedValue([]);

    const [product] = await service.findAll({});

    expect(processedItemsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: MlProcessedOrderItemStatus.PENDING }),
      }),
    );
    expect(product.projectedStock).toBe(10);
  });

  it('suma varios items pending del mismo producto (kit con varios componentes)', async () => {
    productsRepository.find.mockResolvedValue([buildProduct({ stock: 10 })]);
    processedItemsRepository.find.mockResolvedValue([
      { productId: 'product-1', quantity: 2 },
      { productId: 'product-1', quantity: 1 },
    ]);

    const [product] = await service.findAll({});

    expect(product.projectedStock).toBe(7);
  });

  it('no consulta ventas pendientes cuando no hay productos', async () => {
    productsRepository.find.mockResolvedValue([]);

    const result = await service.findAll({});

    expect(result).toEqual([]);
    expect(processedItemsRepository.find).not.toHaveBeenCalled();
  });
});
