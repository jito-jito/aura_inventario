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
import { In, IsNull, Repository } from 'typeorm';
import { MlAuthService } from '../mercadolibre/ml-auth.service';
import { QueryProductsDto } from '../products/dto/query-products.dto';
import { Product } from '../products/entities/product.entity';
import { CreateMlListingDto } from './dto/create-ml-listing.dto';
import { UpdateMlListingComponentsDto } from './dto/update-ml-listing-components.dto';
import { MlListingComponent } from './entities/ml-listing-component.entity';
import { MlListing } from './entities/ml-listing.entity';

interface MlItemAttributeCombination {
  name?: string;
  value_name?: string | null;
}

interface MlSearchVariation {
  id: number;
  attribute_combinations?: MlItemAttributeCombination[];
}

interface MlItem {
  id: string;
  title: string;
  seller_id: number;
  thumbnail?: string;
  secure_thumbnail?: string;
  price?: number;
  variations?: MlSearchVariation[];
}

/** Arma el mismo texto legible ("Azul / M") usado en el buscador, a partir de los atributos de la variación. */
function buildVariationLabel(variation: MlSearchVariation): string {
  return (
    (variation.attribute_combinations ?? [])
      .map((a) => a.value_name)
      .filter(Boolean)
      .join(' / ') || `Variación ${variation.id}`
  );
}

interface MlMultiGetEntry {
  code: number;
  body: {
    id: string;
    title: string;
    thumbnail?: string;
    secure_thumbnail?: string;
    price?: number;
    available_quantity?: number;
    variations?: MlSearchVariation[];
  };
}

export interface MlSearchItemVariation {
  id: string;
  label: string;
  alreadyLinked: boolean;
}

export interface MlSearchItem {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number | null;
  availableQuantity: number | null;
  variations: MlSearchItemVariation[];
  alreadyLinked: boolean;
}

/** Mercado Libre solo permite consultar hasta 20 ids por llamada al endpoint multiget de items. */
const MULTIGET_CHUNK_SIZE = 20;
/** Tamaño de página al recorrer /items/search (máximo permitido por Mercado Libre para este endpoint). */
const SEARCH_PAGE_SIZE = 50;
/**
 * Con paginación por offset, Mercado Libre no permite offset+limit > 1000 en este
 * endpoint (hay que usar search_type=scan con scroll_id para catálogos más grandes,
 * fuera de alcance de este MVP). Se corta ahí y se loguea si hace falta.
 */
const SEARCH_OFFSET_CAP = 1000;

interface MlSearchResponse {
  results: string[];
  paging?: { total: number; offset: number; limit: number };
}

/**
 * A pesar de pedir `secure_thumbnail`, la API de Mercado Libre a veces solo devuelve
 * `thumbnail` en http://. Forzamos https acá (mlstatic.com sirve el mismo recurso por
 * ambos esquemas) para no romper por "mixed content" cuando el frontend corre en https.
 */
function toSecureThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//, 'https://');
}

@Injectable()
export class MlListingsService {
  private readonly logger = new Logger(MlListingsService.name);

  constructor(
    private readonly http: HttpService,
    private readonly mlAuthService: MlAuthService,
    @InjectRepository(MlListing) private readonly listingsRepository: Repository<MlListing>,
    @InjectRepository(MlListingComponent)
    private readonly componentsRepository: Repository<MlListingComponent>,
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
  ) {}

  private async fetchItem(mlItemId: string): Promise<MlItem> {
    try {
      const accessToken = await this.mlAuthService.getValidAccessToken();
      const response = await firstValueFrom(
        this.http.get<MlItem>(`https://api.mercadolibre.com/items/${mlItemId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
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

  private async validateComponents(
    components: CreateMlListingDto['components'],
  ): Promise<void> {
    const productIds = components.map((c) => c.productId);
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      throw new BadRequestException('No se puede repetir el mismo producto como componente');
    }

    const products = await this.productsRepository.findBy({ id: In(productIds) });
    if (products.length !== uniqueProductIds.size) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Producto(s) no encontrado(s): ${missing.join(', ')}`);
    }
  }

  async create(dto: CreateMlListingDto): Promise<MlListing> {
    await this.validateComponents(dto.components);

    const item = await this.fetchItem(dto.mlItemId);

    const connectedMlUserId = await this.mlAuthService.getConnectedMlUserId();
    if (connectedMlUserId && String(item.seller_id) !== connectedMlUserId) {
      throw new BadRequestException(
        'Esa publicación no pertenece a la cuenta de Mercado Libre conectada',
      );
    }

    let variationLabel: string | null = null;
    if (dto.mlVariationId) {
      const variation = item.variations?.find(
        (v) => String(v.id) === dto.mlVariationId,
      );
      if (!variation) {
        throw new BadRequestException(
          `La publicación ${dto.mlItemId} no tiene una variación con id ${dto.mlVariationId}`,
        );
      }
      variationLabel = buildVariationLabel(variation);
    }

    const existing = await this.listingsRepository.findOne({
      where: {
        mlItemId: dto.mlItemId,
        mlVariationId: dto.mlVariationId ?? IsNull(),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Esa publicación ya está vinculada; desvinculala primero si querés cambiar sus componentes',
      );
    }

    const listing = this.listingsRepository.create({
      mlItemId: dto.mlItemId,
      mlVariationId: dto.mlVariationId ?? null,
      variationLabel,
      title: item.title,
      thumbnail: toSecureThumbnail(item.secure_thumbnail ?? item.thumbnail),
      price: item.price ?? null,
      components: dto.components.map((c) =>
        this.componentsRepository.create({
          productId: c.productId,
          quantityPerUnit: c.quantityPerUnit ?? 1,
        }),
      ),
    });

    const saved = await this.listingsRepository.save(listing);
    return this.findOneOrThrow(saved.id);
  }

  private async findOneOrThrow(id: string): Promise<MlListing> {
    const listing = await this.listingsRepository.findOne({
      where: { id },
      relations: { components: { product: true } },
    });
    if (!listing) {
      throw new NotFoundException('Vínculo no encontrado');
    }
    return listing;
  }

  findAll(): Promise<MlListing[]> {
    return this.listingsRepository.find({
      relations: { components: { product: true } },
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

  /** Reemplaza por completo los componentes (productos internos) de un vínculo ya existente. */
  async updateComponents(
    id: string,
    dto: UpdateMlListingComponentsDto,
  ): Promise<MlListing> {
    const listing = await this.listingsRepository.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException('Vínculo no encontrado');
    }

    await this.validateComponents(dto.components);

    await this.componentsRepository.delete({ listingId: id });
    await this.componentsRepository.save(
      dto.components.map((c) =>
        this.componentsRepository.create({
          listingId: id,
          productId: c.productId,
          quantityPerUnit: c.quantityPerUnit ?? 1,
        }),
      ),
    );

    return this.findOneOrThrow(id);
  }

  async findUnlinkedProducts(query: QueryProductsDto = {}): Promise<Product[]> {
    const qb = this.productsRepository
      .createQueryBuilder('product')
      .leftJoin(MlListingComponent, 'component', 'component.product_id = product.id')
      .where('component.id IS NULL');

    if (query.search) {
      qb.andWhere('(product.sku ILIKE :search OR product.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    let products = await qb.orderBy('product.name', 'ASC').getMany();

    if (query.stockStatus === 'critical') {
      products = products.filter((product) => product.stock <= product.minStock);
    } else if (query.stockStatus === 'ok') {
      products = products.filter((product) => product.stock > product.minStock);
    }

    if (query.sortByStock) {
      const direction = query.sortByStock === 'asc' ? 1 : -1;
      products = [...products].sort((a, b) => (a.stock - b.stock) * direction);
    }

    return products;
  }

  /**
   * Trae todas las publicaciones reales del vendedor conectado (recorriendo todas
   * las páginas de /items/search), para elegirlas al vincular en vez de tener que ir
   * a buscar el item_id manualmente. Ver SEARCH_OFFSET_CAP para el límite de Mercado
   * Libre en catálogos muy grandes.
   */
  async searchMyListings(): Promise<MlSearchItem[]> {
    const mlUserId = await this.mlAuthService.getConnectedMlUserId();
    if (!mlUserId) {
      throw new BadRequestException('No hay una cuenta de Mercado Libre conectada');
    }
    const accessToken = await this.mlAuthService.getValidAccessToken();

    const itemIds = await this.searchItemIds(mlUserId, accessToken);
    if (itemIds.length === 0) {
      return [];
    }

    const items = await this.fetchItemsDetail(itemIds, accessToken);
    const existingListings = await this.listingsRepository.find({
      select: { mlItemId: true, mlVariationId: true },
    });
    // Clave por combinación item+variación (no solo item_id), para no bloquear otras
    // variaciones todavía libres de una publicación que ya tiene una vinculada.
    const linkedPairs = new Set(existingListings.map((l) => `${l.mlItemId}::${l.mlVariationId ?? ''}`));

    return items.map((item) => {
      const variations = (item.variations ?? []).map((variation) => ({
        id: String(variation.id),
        label: buildVariationLabel(variation),
        alreadyLinked: linkedPairs.has(`${item.id}::${variation.id}`),
      }));

      return {
        id: item.id,
        title: item.title,
        thumbnail: toSecureThumbnail(item.secure_thumbnail ?? item.thumbnail),
        price: item.price ?? null,
        availableQuantity: item.available_quantity ?? null,
        variations,
        alreadyLinked:
          variations.length > 0
            ? variations.every((v) => v.alreadyLinked)
            : linkedPairs.has(`${item.id}::`),
      };
    });
  }

  private async searchItemIds(mlUserId: string, accessToken: string): Promise<string[]> {
    const allIds: string[] = [];
    let offset = 0;

    try {
      while (offset < SEARCH_OFFSET_CAP) {
        const response = await firstValueFrom(
          this.http.get<MlSearchResponse>(
            `https://api.mercadolibre.com/users/${mlUserId}/items/search`,
            {
              params: { limit: SEARCH_PAGE_SIZE, offset },
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          ),
        );
        const { results, paging } = response.data;
        allIds.push(...results);
        offset += SEARCH_PAGE_SIZE;

        const total = paging?.total ?? allIds.length;
        if (results.length === 0 || allIds.length >= total) {
          return allIds;
        }
      }

      this.logger.warn(
        `El vendedor ${mlUserId} tiene más de ${SEARCH_OFFSET_CAP} publicaciones; solo se trajeron las primeras ${allIds.length} (paginación por offset agotada).`,
      );
      return allIds;
    } catch (err) {
      const message = this.extractErrorMessage(err);
      this.logger.error(`Error al buscar publicaciones del vendedor ${mlUserId}: ${message}`);
      throw new BadRequestException(`No se pudieron consultar tus publicaciones en Mercado Libre: ${message}`);
    }
  }

  private async fetchItemsDetail(
    itemIds: string[],
    accessToken: string,
  ): Promise<MlMultiGetEntry['body'][]> {
    const chunks: string[][] = [];
    for (let i = 0; i < itemIds.length; i += MULTIGET_CHUNK_SIZE) {
      chunks.push(itemIds.slice(i, i + MULTIGET_CHUNK_SIZE));
    }

    const results: MlMultiGetEntry['body'][] = [];
    for (const chunk of chunks) {
      try {
        const response = await firstValueFrom(
          this.http.get<MlMultiGetEntry[]>('https://api.mercadolibre.com/items', {
            params: {
              ids: chunk.join(','),
              attributes: 'id,title,thumbnail,secure_thumbnail,price,available_quantity,variations',
            },
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        );
        for (const entry of response.data) {
          if (entry.code === 200) {
            results.push(entry.body);
          }
        }
      } catch (err) {
        const message = this.extractErrorMessage(err);
        this.logger.error(`Error al consultar el detalle de publicaciones: ${message}`);
        throw new BadRequestException(`No se pudo consultar el detalle de tus publicaciones: ${message}`);
      }
    }
    return results;
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof AxiosError) {
      const data = err.response?.data as { message?: string; error?: string } | undefined;
      return data?.message ?? data?.error ?? err.message;
    }
    return err instanceof Error ? err.message : 'Error desconocido';
  }
}
