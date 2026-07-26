import { BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { MlAuthService } from './ml-auth.service';
import { MlConnection, MlConnectionStatus } from './entities/ml-connection.entity';

describe('MlAuthService', () => {
  let service: MlAuthService;
  let httpService: { post: jest.Mock; get: jest.Mock };
  let configService: { get: jest.Mock };
  let repository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  const config: Record<string, string> = {
    MELI_CLIENT_ID: 'client-id',
    MELI_CLIENT_SECRET: 'client-secret',
    MELI_REDIRECT_URI: 'http://localhost:3000/ml/auth/callback',
  };

  beforeEach(() => {
    httpService = { post: jest.fn(), get: jest.fn() };
    configService = {
      get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
    };
    repository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(() => ({}) as MlConnection),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    service = new MlAuthService(
      configService as any,
      httpService as any,
      repository as any,
    );
  });

  describe('buildAuthorizationUrl', () => {
    it('genera una URL con PKCE y state', () => {
      const { url } = service.buildAuthorizationUrl();
      const parsed = new URL(url);

      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/ml/auth/callback',
      );
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('state')).toBeTruthy();
      expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
    });
  });

  describe('handleCallback', () => {
    it('rechaza si Mercado Libre devolvió un error', async () => {
      await expect(service.handleCallback(undefined, undefined, 'access_denied')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si falta code o state', async () => {
      await expect(service.handleCallback(undefined, 'state-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza un state que no fue emitido por buildAuthorizationUrl', async () => {
      await expect(service.handleCallback('code-1', 'unknown-state')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('intercambia el code por tokens y guarda la conexión', async () => {
      const { url } = service.buildAuthorizationUrl();
      const state = new URL(url).searchParams.get('state')!;

      httpService.post.mockReturnValueOnce(
        of({
          data: {
            access_token: 'access-token-1',
            token_type: 'bearer',
            expires_in: 21600,
            scope: 'offline_access read write',
            user_id: 123456,
            refresh_token: 'refresh-token-1',
          },
        }),
      );
      httpService.get.mockReturnValueOnce(of({ data: { id: 123456, nickname: 'VENDEDOR_TEST' } }));

      await service.handleCallback('auth-code', state);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.mercadolibre.com/oauth/token',
        expect.stringContaining('grant_type=authorization_code'),
        expect.any(Object),
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          mlUserId: '123456',
          nickname: 'VENDEDOR_TEST',
          accessToken: 'access-token-1',
          refreshToken: 'refresh-token-1',
          status: MlConnectionStatus.CONNECTED,
        }),
      );

      // El state ya fue consumido, un segundo intento debe fallar.
      await expect(service.handleCallback('auth-code', state)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propaga un mensaje legible cuando Mercado Libre rechaza el intercambio', async () => {
      const { url } = service.buildAuthorizationUrl();
      const state = new URL(url).searchParams.get('state')!;

      const axiosError = new AxiosError('Request failed');
      axiosError.response = {
        data: { message: 'invalid_grant: code inválido' },
      } as any;
      httpService.post.mockReturnValueOnce(throwError(() => axiosError));

      await expect(service.handleCallback('bad-code', state)).rejects.toThrow(
        'Mercado Libre rechazó la solicitud: invalid_grant: code inválido',
      );
    });
  });

  describe('getStatus', () => {
    it('devuelve connected:false si no hay conexión guardada', async () => {
      repository.find.mockResolvedValue([]);
      await expect(service.getStatus()).resolves.toEqual({ connected: false });
    });

    it('devuelve connected:true sin refrescar si el token todavía es válido', async () => {
      const connection: Partial<MlConnection> = {
        mlUserId: '123456',
        nickname: 'VENDEDOR_TEST',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
      repository.find.mockResolvedValue([connection]);

      const status = await service.getStatus();

      expect(status).toEqual(
        expect.objectContaining({ connected: true, mlUserId: '123456', nickname: 'VENDEDOR_TEST' }),
      );
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('refresca el token si está por vencer y actualiza la conexión', async () => {
      const connection: Partial<MlConnection> = {
        mlUserId: '123456',
        nickname: 'VENDEDOR_TEST',
        accessToken: 'expiring-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 1000),
      };
      repository.find.mockResolvedValue([connection]);
      httpService.post.mockReturnValueOnce(
        of({
          data: {
            access_token: 'new-access-token',
            token_type: 'bearer',
            expires_in: 21600,
            user_id: 123456,
            refresh_token: 'new-refresh-token',
          },
        }),
      );

      const status = await service.getStatus();

      expect(status.connected).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }),
      );
    });

    it('marca la conexión como error si el refresh falla', async () => {
      const connection: Partial<MlConnection> = {
        mlUserId: '123456',
        accessToken: 'expiring-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() + 60 * 1000),
      };
      repository.find.mockResolvedValue([connection]);

      const axiosError = new AxiosError('Request failed');
      axiosError.response = { data: { message: 'invalid_token' } } as any;
      httpService.post.mockReturnValueOnce(throwError(() => axiosError));

      const status = await service.getStatus();

      expect(status.connected).toBe(false);
      expect(status.lastError).toContain('invalid_token');
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: MlConnectionStatus.ERROR }),
      );
    });
  });

  describe('disconnect', () => {
    it('elimina la conexión existente', async () => {
      const connection: Partial<MlConnection> = { mlUserId: '123456' };
      repository.find.mockResolvedValue([connection]);

      await service.disconnect();

      expect(repository.remove).toHaveBeenCalledWith(connection);
    });

    it('no falla si no hay conexión guardada', async () => {
      repository.find.mockResolvedValue([]);
      await expect(service.disconnect()).resolves.toBeUndefined();
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
