import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { InventoryMovement, MovementType } from './entities/inventory-movement.entity';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let product: Product;

  const buildProductQueryBuilder = () => ({
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockImplementation(async () => product),
  });

  const fakeManager = {
    getRepository: jest.fn((entity) => {
      if (entity === Product) {
        return {
          createQueryBuilder: jest.fn(() => buildProductQueryBuilder()),
          save: jest.fn(async (p: Product) => {
            product = p;
            return p;
          }),
        };
      }
      return {
        create: jest.fn((data) => data),
        save: jest.fn(async (data) => ({ id: 'movement-id', ...data })),
      };
    }),
  };

  const dataSourceMock = {
    transaction: jest.fn((cb) => cb(fakeManager)),
  };

  beforeEach(async () => {
    product = {
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getDataSourceToken(), useValue: dataSourceMock },
        { provide: getRepositoryToken(InventoryMovement), useValue: {} },
      ],
    }).compile();

    service = module.get(InventoryService);
    jest.clearAllMocks();
  });

  it('suma la cantidad en una entrada (IN)', async () => {
    const movement = await service.registerMovement({
      productId: 'product-1',
      type: MovementType.IN,
      quantity: 5,
    });

    expect(product.stock).toBe(15);
    expect(movement.quantity).toBe(5);
    expect(movement.balanceAfter).toBe(15);
  });

  it('resta la cantidad en una salida (OUT)', async () => {
    const movement = await service.registerMovement({
      productId: 'product-1',
      type: MovementType.OUT,
      quantity: 4,
    });

    expect(product.stock).toBe(6);
    expect(movement.balanceAfter).toBe(6);
  });

  it('permite una salida que deja stock negativo', async () => {
    const movement = await service.registerMovement({
      productId: 'product-1',
      type: MovementType.OUT,
      quantity: 999,
    });

    expect(product.stock).toBe(-989);
    expect(movement.balanceAfter).toBe(-989);
  });

  it('aplica el delta con signo en un ajuste (ADJUSTMENT)', async () => {
    const movement = await service.registerMovement({
      productId: 'product-1',
      type: MovementType.ADJUSTMENT,
      quantity: -3,
      reason: 'merma',
    });

    expect(product.stock).toBe(7);
    expect(movement.quantity).toBe(-3);
  });

  it('exige un motivo para los ajustes', async () => {
    await expect(
      service.registerMovement({
        productId: 'product-1',
        type: MovementType.ADJUSTMENT,
        quantity: 3,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza NotFoundException si el producto no existe', async () => {
    product = undefined as unknown as Product;

    await expect(
      service.registerMovement({
        productId: 'missing',
        type: MovementType.IN,
        quantity: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
