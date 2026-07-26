import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateMlListingPayload, MlListing } from './models/ml-listing.model';
import { Product } from './models/product.model';

@Injectable({ providedIn: 'root' })
export class MlListingsService {
  private readonly baseUrl = `${environment.apiUrl}/ml/listings`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Promise<MlListing[]> {
    return firstValueFrom(this.http.get<MlListing[]>(this.baseUrl));
  }

  findUnlinkedProducts(): Promise<Product[]> {
    return firstValueFrom(this.http.get<Product[]>(`${this.baseUrl}/unlinked-products`));
  }

  create(payload: CreateMlListingPayload): Promise<MlListing> {
    return firstValueFrom(this.http.post<MlListing>(this.baseUrl, payload));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
  }
}
