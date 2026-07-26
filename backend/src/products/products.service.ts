import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { MovementType } from '../inventory/entities/inventory-movement.entity';
import { InventoryService } from '../inventory/inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
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

    if (dto.stock && dto.stock > 0) {
      await this.inventoryService.registerMovement({
        productId: product.id,
        type: MovementType.IN,
        quantity: dto.stock,
        reason: 'Stock inicial',
      });
      product.stock = dto.stock;
    }

    return product;
  }

  async findAll(query: QueryProductsDto): Promise<Product[]> {
    const where = query.search
      ? [{ sku: ILike(`%${query.search}%`) }, { name: ILike(`%${query.search}%`) }]
      : {};

    const products = await this.productsRepository.find({
      where,
      order: { name: 'ASC' },
    });

    if (query.lowStock) {
      return products.filter((product) => product.stock <= product.minStock);
    }

    return products;
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
}
