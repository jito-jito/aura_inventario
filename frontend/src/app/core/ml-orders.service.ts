import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MlProcessedOrderItem, MlProcessedOrderItemStatus } from './models/ml-processed-order-item.model';

@Injectable({ providedIn: 'root' })
export class MlOrdersService {
  private readonly baseUrl = `${environment.apiUrl}/ml/orders`;

  constructor(private readonly http: HttpClient) {}

  findProcessed(params?: {
    dateFrom?: string;
    dateTo?: string;
    status?: MlProcessedOrderItemStatus;
    search?: string;
  }): Promise<MlProcessedOrderItem[]> {
    const query: Record<string, string> = {};
    if (params?.dateFrom) query['dateFrom'] = params.dateFrom;
    if (params?.dateTo) query['dateTo'] = params.dateTo;
    if (params?.status) query['status'] = params.status;
    if (params?.search) query['search'] = params.search;
    return firstValueFrom(
      this.http.get<MlProcessedOrderItem[]>(`${this.baseUrl}/processed`, { params: query }),
    );
  }
}
