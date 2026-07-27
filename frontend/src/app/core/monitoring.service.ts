import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { IntegrationErrorItem } from './models/integration-error.model';

@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private readonly baseUrl = `${environment.apiUrl}/monitoring`;

  constructor(private readonly http: HttpClient) {}

  getErrors(): Promise<IntegrationErrorItem[]> {
    return firstValueFrom(this.http.get<IntegrationErrorItem[]>(`${this.baseUrl}/errors`));
  }
}
