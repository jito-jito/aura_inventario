import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MlConnectionStatus } from './models/ml-connection.model';

@Injectable({ providedIn: 'root' })
export class MlConnectionService {
  private readonly baseUrl = `${environment.apiUrl}/ml/auth`;

  constructor(private readonly http: HttpClient) {}

  async getAuthorizationUrl(): Promise<string> {
    const response = await firstValueFrom(
      this.http.get<{ url: string }>(`${this.baseUrl}/connect`),
    );
    return response.url;
  }

  getStatus(): Promise<MlConnectionStatus> {
    return firstValueFrom(this.http.get<MlConnectionStatus>(`${this.baseUrl}/status`));
  }

  async disconnect(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.baseUrl}/disconnect`, {}));
  }
}
