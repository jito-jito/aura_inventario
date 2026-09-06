import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateMlListingComponentPayload,
  CreateMlListingPayload,
  MlListing,
  MlSearchItem,
} from './models/ml-listing.model';
import { Product } from './models/product.model';

@Injectable({ providedIn: 'root' })
export class MlListingsService {
  private readonly baseUrl = `${environment.apiUrl}/ml/listings`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Promise<MlListing[]> {
    return firstValueFrom(this.http.get<MlListing[]>(this.baseUrl));
  }

  findUnlinkedProducts(params?: {
    search?: string;
    stockStatus?: 'critical' | 'ok';
    sortByStock?: 'asc' | 'desc';
  }): Promise<Product[]> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.stockStatus) query['stockStatus'] = params.stockStatus;
    if (params?.sortByStock) query['sortByStock'] = params.sortByStock;
    return firstValueFrom(
      this.http.get<Product[]>(`${this.baseUrl}/unlinked-products`, { params: query }),
    );
  }

  searchMyListings(): Promise<MlSearchItem[]> {
    return firstValueFrom(this.http.get<MlSearchItem[]>(`${this.baseUrl}/search-ml`));
  }

  create(payload: CreateMlListingPayload): Promise<MlListing> {
    return firstValueFrom(this.http.post<MlListing>(this.baseUrl, payload));
  }

  updateComponents(
    id: string,
    components: CreateMlListingComponentPayload[],
  ): Promise<MlListing> {
    return firstValueFrom(this.http.patch<MlListing>(`${this.baseUrl}/${id}`, { components }));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
  }
}
