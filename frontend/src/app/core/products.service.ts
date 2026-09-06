import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateProductPayload, Product, UpdateProductPayload } from './models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly baseUrl = `${environment.apiUrl}/products`;

  constructor(private readonly http: HttpClient) {}

  findAll(params?: {
    search?: string;
    stockStatus?: 'critical' | 'ok';
    sortByStock?: 'asc' | 'desc';
  }): Promise<Product[]> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.stockStatus) query['stockStatus'] = params.stockStatus;
    if (params?.sortByStock) query['sortByStock'] = params.sortByStock;
    return firstValueFrom(this.http.get<Product[]>(this.baseUrl, { params: query }));
  }

  findOne(id: string): Promise<Product> {
    return firstValueFrom(this.http.get<Product>(`${this.baseUrl}/${id}`));
  }

  create(payload: CreateProductPayload): Promise<Product> {
    return firstValueFrom(this.http.post<Product>(this.baseUrl, payload));
  }

  update(id: string, payload: UpdateProductPayload): Promise<Product> {
    return firstValueFrom(this.http.patch<Product>(`${this.baseUrl}/${id}`, payload));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
  }
}
