import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { IsNull, Repository } from 'typeorm';
import { MlAuthService } from '../mercadolibre/ml-auth.service';
import { Product } from '../products/entities/product.entity';
import { CreateMlListingDto } from './dto/create-ml-listing.dto';
import { MlListing } from './entities/ml-listing.entity';

interface MlItem {
  id: string;
  title: string;
  seller_id: number;
  variations?: { id: number }[];
}

@Injectable()
export class MlListingsService {
  private readonly logger = new Logger(MlListingsService.name);

  constructor(
    private readonly http: HttpService,
    private readonly mlAuthService: MlAuthService,
    @InjectRepository(MlListing) private readonly listingsRepository: Repository<MlListing>,
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
  ) {}

  private async fetchItem(mlItemId: string): Promise<MlItem> {
    try {
      const response = await firstValueFrom(
        this.http.get<MlItem>(`https://api.mercadolibre.com/items/${mlItemId}`),
      );
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        throw new BadRequestException(`La publicación ${mlItemId} no existe en Mercado Libre`);
      }
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(`Error al consultar la publicación ${mlItemId}: ${message}`);
      throw new BadRequestException(`No se pudo consultar la publicación en Mercado Libre: ${message}`);
    }
  }

  async create(dto: CreateMlListingDto): Promise<MlListing> {
    const product = await this.productsRepository.findOne({ where: { id: dto.productId } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const item = await this.fetchItem(dto.mlItemId);

    const connectedMlUserId = await this.mlAuthService.getConnectedMlUserId();
    if (connectedMlUserId && String(item.seller_id) !== connectedMlUserId) {
      throw new BadRequestException(
        'Esa publicación no pertenece a la cuenta de Mercado Libre conectada',
      );
    }

    if (dto.mlVariationId) {
      const variationExists = item.variations?.some(
        (variation) => String(variation.id) === dto.mlVariationId,
      );
      if (!variationExists) {
        throw new BadRequestException(
          `La publicación ${dto.mlItemId} no tiene una variación con id ${dto.mlVariationId}`,
        );
      }
    }

    const existing = await this.listingsRepository.findOne({
      where: {
        mlItemId: dto.mlItemId,
        mlVariationId: dto.mlVariationId ?? IsNull(),
      },
      relations: { product: true },
    });
    if (existing) {
      throw new ConflictException(
        `Esa publicación ya está vinculada al producto "${existing.product.name}" (${existing.product.sku})`,
      );
    }

    const listing = this.listingsRepository.create({
      productId: product.id,
      mlItemId: dto.mlItemId,
      mlVariationId: dto.mlVariationId ?? null,
      title: item.title,
    });

    return this.listingsRepository.save(listing);
  }

  findAll(): Promise<MlListing[]> {
    return this.listingsRepository.find({
      relations: { product: true },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    const listing = await this.listingsRepository.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException('Vínculo no encontrado');
    }
    await this.listingsRepository.remove(listing);
  }

  async findUnlinkedProducts(): Promise<Product[]> {
    return this.productsRepository
      .createQueryBuilder('product')
      .leftJoin(MlListing, 'listing', 'listing.product_id = product.id')
      .where('listing.id IS NULL')
      .orderBy('product.name', 'ASC')
      .getMany();
  }
}
