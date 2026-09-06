import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { MlListingsService } from './ml-listings.service';

describe('MlListingsService', () => {
  let service: MlListingsService;
  let httpService: { get: jest.Mock };
  let mlAuthService: { getConnectedMlUserId: jest.Mock; getValidAccessToken: jest.Mock };
  let listingsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };
  let componentsRepository: { create: jest.Mock };
  let productsRepository: {
    findBy: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const productA = { id: 'product-1', sku: 'SKU-1', name: 'Lienzo' };
  const productB = { id: 'product-2', sku: 'SKU-2', name: 'Marco' };

  beforeEach(() => {
    httpService = { get: jest.fn() };
    mlAuthService = {
      getConnectedMlUserId: jest.fn().mockResolvedValue(null),
      getValidAccessToken: jest.fn().mockResolvedValue('valid-access-token'),
    };
    listingsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'listing-1', ...data })),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    componentsRepository = {
      create: jest.fn((data) => data),
    };
    productsRepository = {
      findBy: jest.fn().mockResolvedValue([productA]),
      createQueryBuilder: jest.fn(),
    };

    service = new MlListingsService(
      httpService as any,
      mlAuthService as any,
      listingsRepository as any,
      componentsRepository as any,
      productsRepository as any,
    );
  });

  describe('create', () => {
    it('rechaza si algún producto componente no existe', async () => {
      productsRepository.findBy.mockResolvedValue([]);
      await expect(
        service.create({ mlItemId: 'MLA1', components: [{ productId: 'missing' }] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza componentes con el mismo producto repetido', async () => {
      await expect(
        service.create({
          mlItemId: 'MLA1',
          components: [{ productId: 'product-1' }, { productId: 'product-1' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la publicación no existe en Mercado Libre (404)', async () => {
      const axiosError = new AxiosError('Not Found');
      axiosError.response = { status: 404 } as any;
      httpService.get.mockReturnValueOnce(throwError(() => axiosError));

      await expect(
        service.create({ mlItemId: 'MLA-NOPE', components: [{ productId: 'product-1' }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si falla la consulta a Mercado Libre por otro motivo', async () => {
      httpService.get.mockReturnValueOnce(throwError(() => new Error('network down')));

      await expect(
        service.create({ mlItemId: 'MLA1', components: [{ productId: 'product-1' }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la publicación pertenece a otro vendedor', async () => {
      mlAuthService.getConnectedMlUserId.mockResolvedValue('999');
      httpService.get.mockReturnValueOnce(
        of({ data: { id: 'MLA1', title: 'Item', seller_id: 111 } }),
      );

      await expect(
        service.create({ mlItemId: 'MLA1', components: [{ productId: 'product-1' }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la variación indicada no existe en la publicación', async () => {
      httpService.get.mockReturnValueOnce(
        of({
          data: { id: 'MLA1', title: 'Item', seller_id: 111, variations: [{ id: 1 }] },
        }),
      );

      await expect(
        service.create({
          mlItemId: 'MLA1',
          mlVariationId: '999',
          components: [{ productId: 'product-1' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la publicación ya está vinculada', async () => {
      httpService.get.mockReturnValueOnce(
        of({ data: { id: 'MLA1', title: 'Item', seller_id: 111 } }),
      );
      listingsRepository.findOne.mockResolvedValue({ id: 'listing-existing' });

      await expect(
        service.create({ mlItemId: 'MLA1', components: [{ productId: 'product-1' }] }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea el vínculo con varios componentes (kit)', async () => {
      productsRepository.findBy.mockResolvedValue([productA, productB]);
      mlAuthService.getConnectedMlUserId.mockResolvedValue('111');
      httpService.get.mockReturnValueOnce(
        of({
          data: { id: 'MLA1', title: 'Cuadro completo', seller_id: 111, variations: [{ id: 55 }] },
        }),
      );
      listingsRepository.findOne
        .mockResolvedValueOnce(null) // chequeo de duplicado
        .mockResolvedValueOnce({
          id: 'listing-1',
          mlItemId: 'MLA1',
          mlVariationId: '55',
          title: 'Cuadro completo',
          components: [
            { productId: 'product-1', quantityPerUnit: 1, product: productA },
            { productId: 'product-2', quantityPerUnit: 4, product: productB },
          ],
        }); // findOneOrThrow tras guardar

      const listing = await service.create({
        mlItemId: 'MLA1',
        mlVariationId: '55',
        components: [{ productId: 'product-1' }, { productId: 'product-2', quantityPerUnit: 4 }],
      });

      expect(listingsRepository.save).toHaveBeenCalled();
      expect(listing.components).toHaveLength(2);
      expect(listing.components[1]).toMatchObject({ productId: 'product-2', quantityPerUnit: 4 });
    });
  });

  describe('findAll', () => {
    it('delega en el repositorio con la relación de componentes y sus productos', async () => {
      await service.findAll();
      expect(listingsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { components: { product: true } } }),
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
    it('arma un left join contra los componentes y filtra productos sin ningún vínculo', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([productA]),
      };
      productsRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findUnlinkedProducts();

      expect(qb.where).toHaveBeenCalledWith('component.id IS NULL');
      expect(result).toEqual([productA]);
    });
  });
});
