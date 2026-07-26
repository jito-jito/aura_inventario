import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { MlListingsService } from './ml-listings.service';

describe('MlListingsService', () => {
  let service: MlListingsService;
  let httpService: { get: jest.Mock };
  let mlAuthService: { getConnectedMlUserId: jest.Mock };
  let listingsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };
  let productsRepository: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const product = { id: 'product-1', sku: 'SKU-1', name: 'Producto 1' };

  beforeEach(() => {
    httpService = { get: jest.fn() };
    mlAuthService = { getConnectedMlUserId: jest.fn().mockResolvedValue(null) };
    listingsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'listing-1', ...data })),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    productsRepository = {
      findOne: jest.fn().mockResolvedValue(product),
      createQueryBuilder: jest.fn(),
    };

    service = new MlListingsService(
      httpService as any,
      mlAuthService as any,
      listingsRepository as any,
      productsRepository as any,
    );
  });

  describe('create', () => {
    it('rechaza si el producto no existe', async () => {
      productsRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create({ productId: 'missing', mlItemId: 'MLA1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza si la publicación no existe en Mercado Libre (404)', async () => {
      const axiosError = new AxiosError('Not Found');
      axiosError.response = { status: 404 } as any;
      httpService.get.mockReturnValueOnce(throwError(() => axiosError));

      await expect(
        service.create({ productId: 'product-1', mlItemId: 'MLA-NOPE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si falla la consulta a Mercado Libre por otro motivo', async () => {
      httpService.get.mockReturnValueOnce(throwError(() => new Error('network down')));

      await expect(
        service.create({ productId: 'product-1', mlItemId: 'MLA1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la publicación pertenece a otro vendedor', async () => {
      mlAuthService.getConnectedMlUserId.mockResolvedValue('999');
      httpService.get.mockReturnValueOnce(
        of({ data: { id: 'MLA1', title: 'Item', seller_id: 111 } }),
      );

      await expect(
        service.create({ productId: 'product-1', mlItemId: 'MLA1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la variación indicada no existe en la publicación', async () => {
      httpService.get.mockReturnValueOnce(
        of({
          data: { id: 'MLA1', title: 'Item', seller_id: 111, variations: [{ id: 1 }] },
        }),
      );

      await expect(
        service.create({ productId: 'product-1', mlItemId: 'MLA1', mlVariationId: '999' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la publicación ya está vinculada a otro producto', async () => {
      httpService.get.mockReturnValueOnce(
        of({ data: { id: 'MLA1', title: 'Item', seller_id: 111 } }),
      );
      listingsRepository.findOne.mockResolvedValue({
        id: 'listing-existing',
        product: { name: 'Otro producto', sku: 'OTRO-1' },
      });

      await expect(
        service.create({ productId: 'product-1', mlItemId: 'MLA1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea el vínculo cuando todo es válido', async () => {
      mlAuthService.getConnectedMlUserId.mockResolvedValue('111');
      httpService.get.mockReturnValueOnce(
        of({
          data: { id: 'MLA1', title: 'Zapatillas Running', seller_id: 111, variations: [{ id: 55 }] },
        }),
      );

      const listing = await service.create({
        productId: 'product-1',
        mlItemId: 'MLA1',
        mlVariationId: '55',
      });

      expect(listing).toMatchObject({
        productId: 'product-1',
        mlItemId: 'MLA1',
        mlVariationId: '55',
        title: 'Zapatillas Running',
      });
      expect(listingsRepository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('delega en el repositorio con la relación de producto', async () => {
      await service.findAll();
      expect(listingsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { product: true } }),
      );
    });
  });

  describe('remove', () => {
    it('lanza NotFoundException si el vínculo no existe', async () => {
      listingsRepository.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('elimina el vínculo existente', async () => {
      const listing = { id: 'listing-1' };
      listingsRepository.findOne.mockResolvedValue(listing);
      await service.remove('listing-1');
      expect(listingsRepository.remove).toHaveBeenCalledWith(listing);
    });
  });

  describe('findUnlinkedProducts', () => {
    it('arma un left join contra ml_listings y filtra los que no tienen vínculo', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([product]),
      };
      productsRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findUnlinkedProducts();

      expect(qb.where).toHaveBeenCalledWith('listing.id IS NULL');
      expect(result).toEqual([product]);
    });
  });
});
