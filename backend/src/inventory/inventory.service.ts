import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { CreateMovementDto } from './dto/create-movement.dto';
import { InventoryMovement, MovementType } from './entities/inventory-movement.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(InventoryMovement)
    private readonly movementsRepository: Repository<InventoryMovement>,
  ) {}

  private resolveDelta(type: MovementType, quantity: number): number {
    switch (type) {
      case MovementType.IN:
        if (quantity <= 0) {
          throw new BadRequestException('La cantidad de una entrada debe ser positiva');
        }
        return quantity;
      case MovementType.OUT:
        if (quantity <= 0) {
          throw new BadRequestException('La cantidad de una salida debe ser positiva');
        }
        return -quantity;
      case MovementType.ADJUSTMENT:
        return quantity;
    }
  }

  async registerMovement(dto: CreateMovementDto): Promise<InventoryMovement> {
    if (dto.type === MovementType.ADJUSTMENT && !dto.reason?.trim()) {
      throw new BadRequestException('Un ajuste manual requiere un motivo');
    }

    const delta = this.resolveDelta(dto.type, dto.quantity);

    return this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const product = await productRepo
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: dto.productId })
        .getOne();

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      const newStock = product.stock + delta;
      product.stock = newStock;
      await productRepo.save(product);

      const movement = manager.getRepository(InventoryMovement).create({
        productId: product.id,
        type: dto.type,
        quantity: delta,
        balanceAfter: newStock,
        reason: dto.reason ?? null,
        reference: dto.reference ?? null,
      });

      return manager.getRepository(InventoryMovement).save(movement);
    });
  }

  async findByProduct(productId: string): Promise<InventoryMovement[]> {
    return this.movementsRepository.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(limit = 50): Promise<InventoryMovement[]> {
    return this.movementsRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: { product: true },
    });
  }
}
