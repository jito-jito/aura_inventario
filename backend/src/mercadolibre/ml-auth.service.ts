import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash } from 'crypto';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { MlConnection, MlConnectionStatus } from './entities/ml-connection.entity';

interface MlTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id: number;
  refresh_token: string;
}

interface MlUserInfo {
  id: number;
  nickname: string;
}

interface PendingAuthorization {
  codeVerifier: string;
  createdAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const USER_INFO_URL = 'https://api.mercadolibre.com/users/me';

export interface MlConnectionStatusDto {
  connected: boolean;
  mlUserId?: string;
  nickname?: string;
  expiresAt?: string;
  lastError?: string;
}

@Injectable()
export class MlAuthService {
  private readonly logger = new Logger(MlAuthService.name);
  private readonly pendingAuthorizations = new Map<string, PendingAuthorization>();

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    @InjectRepository(MlConnection) private readonly connectionRepository: Repository<MlConnection>,
  ) {}

  private getConnection(): Promise<MlConnection | null> {
    return this.connectionRepository
      .find({ order: { createdAt: 'DESC' }, take: 1 })
      .then((rows) => rows[0] ?? null);
  }

  private cleanupExpiredAuthorizations(): void {
    const now = Date.now();
    for (const [state, pending] of this.pendingAuthorizations.entries()) {
      if (now - pending.createdAt > STATE_TTL_MS) {
        this.pendingAuthorizations.delete(state);
      }
    }
  }

  buildAuthorizationUrl(): { url: string } {
    this.cleanupExpiredAuthorizations();

    const clientId = this.config.get<string>('MELI_CLIENT_ID');
    const redirectUri = this.config.get<string>('MELI_REDIRECT_URI');
    const authUrl = this.config.get<string>(
      'MELI_AUTH_URL',
      'https://auth.mercadolibre.com.ar/authorization',
    );
    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'MELI_CLIENT_ID / MELI_REDIRECT_URI no están configurados en el backend',
      );
    }

    const state = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    this.pendingAuthorizations.set(state, { codeVerifier, createdAt: Date.now() });

    const url = new URL(authUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return { url: url.toString() };
  }

  async handleCallback(code?: string, state?: string, error?: string): Promise<void> {
    if (error) {
      throw new BadRequestException(`Mercado Libre denegó la conexión: ${error}`);
    }
    if (!code || !state) {
      throw new BadRequestException('Faltan los parámetros code/state en la respuesta de Mercado Libre');
    }

    const pending = this.pendingAuthorizations.get(state);
    if (!pending) {
      throw new BadRequestException('El estado de autorización es inválido o expiró, intentá conectar de nuevo');
    }
    this.pendingAuthorizations.delete(state);

    const clientId = this.config.get<string>('MELI_CLIENT_ID');
    const clientSecret = this.config.get<string>('MELI_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('MELI_REDIRECT_URI');

    const tokenResponse = await this.requestToken({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: pending.codeVerifier,
    });

    const userInfo = await this.fetchUserInfo(tokenResponse.access_token);

    let connection = await this.getConnection();
    if (!connection) {
      connection = this.connectionRepository.create();
    }
    connection.mlUserId = String(tokenResponse.user_id);
    connection.nickname = userInfo.nickname;
    connection.accessToken = tokenResponse.access_token;
    connection.refreshToken = tokenResponse.refresh_token;
    connection.tokenType = tokenResponse.token_type;
    connection.scope = tokenResponse.scope ?? null;
    connection.expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    connection.status = MlConnectionStatus.CONNECTED;
    connection.lastError = null;

    await this.connectionRepository.save(connection);
  }

  async getStatus(): Promise<MlConnectionStatusDto> {
    const connection = await this.getConnection();
    if (!connection) {
      return { connected: false };
    }

    try {
      await this.ensureValidAccessToken(connection);
      return {
        connected: true,
        mlUserId: connection.mlUserId,
        nickname: connection.nickname ?? undefined,
        expiresAt: connection.expiresAt.toISOString(),
      };
    } catch (err) {
      const message = this.extractErrorMessage(err);
      connection.status = MlConnectionStatus.ERROR;
      connection.lastError = message;
      await this.connectionRepository.save(connection);
      return { connected: false, lastError: message };
    }
  }

  async disconnect(): Promise<void> {
    const connection = await this.getConnection();
    if (connection) {
      await this.connectionRepository.remove(connection);
    }
  }

  /** Devuelve un access_token vigente, refrescándolo si está por vencer. Uso interno para SyncModule (fase 5). */
  async ensureValidAccessToken(connection: MlConnection): Promise<string> {
    const msRemaining = connection.expiresAt.getTime() - Date.now();
    if (msRemaining > REFRESH_THRESHOLD_MS) {
      return connection.accessToken;
    }

    const clientId = this.config.get<string>('MELI_CLIENT_ID');
    const clientSecret = this.config.get<string>('MELI_CLIENT_SECRET');

    const tokenResponse = await this.requestToken({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
    });

    connection.accessToken = tokenResponse.access_token;
    connection.refreshToken = tokenResponse.refresh_token;
    connection.expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    connection.status = MlConnectionStatus.CONNECTED;
    connection.lastError = null;
    await this.connectionRepository.save(connection);

    return connection.accessToken;
  }

  private async requestToken(params: Record<string, string | undefined>): Promise<MlTokenResponse> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) body.set(key, value);
    }

    try {
      const response = await firstValueFrom(
        this.http.post<MlTokenResponse>(TOKEN_URL, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
        }),
      );
      return response.data;
    } catch (err) {
      const message = this.extractErrorMessage(err);
      this.logger.error(`Error al obtener token de Mercado Libre: ${message}`);
      throw new BadRequestException(`Mercado Libre rechazó la solicitud: ${message}`);
    }
  }

  private async fetchUserInfo(accessToken: string): Promise<MlUserInfo> {
    const response = await firstValueFrom(
      this.http.get<MlUserInfo>(USER_INFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return response.data;
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof AxiosError) {
      const data = err.response?.data as { message?: string; error?: string } | undefined;
      return data?.message ?? data?.error ?? err.message;
    }
    return err instanceof Error ? err.message : 'Error desconocido';
  }
}
