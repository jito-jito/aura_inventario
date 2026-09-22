import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { MovementType } from '../inventory/entities/inventory-movement.entity';
import { InventoryService } from '../inventory/inventory.service';
import {
  MlProcessedOrderItem,
  MlProcessedOrderItemStatus,
} from '../ml-orders/entities/ml-processed-order-item.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

export type ProductWithProjectedStock = Product & { projectedStock: number };

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
    @InjectRepository(MlProcessedOrderItem)
    private readonly processedItemsRepository: Repository<MlProcessedOrderItem>,
    private readonly inventoryService: InventoryService,
  ) {}

  private async assertSkuAvailable(sku: string, excludeId?: string): Promise<void> {
    const existing = await this.productsRepository.findOne({ where: { sku } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Ya existe un producto con el SKU "${sku}"`);
    }
  }

  async create(dto: CreateProductDto): Promise<Product> {
    await this.assertSkuAvailable(dto.sku);

    const product = await this.productsRepository.save(
      this.productsRepository.create({
        sku: dto.sku,
        name: dto.name,
        description: dto.description ?? null,
        cost: dto.cost.toFixed(2),
        stock: 0,
        minStock: dto.minStock ?? 5,
      }),
    );

    if (dto.stock) {
      await this.inventoryService.registerMovement({
        productId: product.id,
        type: dto.stock > 0 ? MovementType.IN : MovementType.ADJUSTMENT,
        quantity: dto.stock,
        reason: 'Stock inicial',
      });
      product.stock = dto.stock;
    }

    return product;
  }

  async findAll(query: QueryProductsDto): Promise<ProductWithProjectedStock[]> {
    const where = query.search
      ? [{ sku: ILike(`%${query.search}%`) }, { name: ILike(`%${query.search}%`) }]
      : {};

    let products = await this.productsRepository.find({
      where,
      order: { name: 'ASC' },
    });

    if (query.stockStatus === 'critical') {
      products = products.filter((product) => product.stock <= product.minStock);
    } else if (query.stockStatus === 'ok') {
      products = products.filter((product) => product.stock > product.minStock);
    }

    if (query.sortByStock) {
      const direction = query.sortByStock === 'asc' ? 1 : -1;
      products = [...products].sort((a, b) => (a.stock - b.stock) * direction);
    }

    const pendingByProduct = await this.getPendingQuantitiesByProduct(
      products.map((product) => product.id),
    );

    return products.map((product) => ({
      ...product,
      projectedStock: product.stock - (pendingByProduct.get(product.id) ?? 0),
    }));
  }

  private async getPendingQuantitiesByProduct(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const pendingItems = await this.processedItemsRepository.find({
      where: { productId: In(productIds), status: MlProcessedOrderItemStatus.PENDING },
      select: { productId: true, quantity: true },
    });

    return pendingItems.reduce((map, item) => {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
      return map;
    }, new Map<string, number>());
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (dto.sku && dto.sku !== product.sku) {
      await this.assertSkuAvailable(dto.sku, id);
      product.sku = dto.sku;
    }
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.cost !== undefined) product.cost = dto.cost.toFixed(2);
    if (dto.minStock !== undefined) product.minStock = dto.minStock;

    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productsRepository.remove(product);
  }
}
