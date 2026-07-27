import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MlProcessedOrderItem } from './models/ml-processed-order-item.model';

@Injectable({ providedIn: 'root' })
export class MlOrdersService {
  private readonly baseUrl = `${environment.apiUrl}/ml/orders`;

  constructor(private readonly http: HttpClient) {}

  findRecentlyProcessed(): Promise<MlProcessedOrderItem[]> {
    return firstValueFrom(this.http.get<MlProcessedOrderItem[]>(`${this.baseUrl}/processed`));
  }
}
