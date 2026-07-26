import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateProductPayload, Product, UpdateProductPayload } from './models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly baseUrl = `${environment.apiUrl}/products`;

  constructor(private readonly http: HttpClient) {}

  findAll(params?: { search?: string; lowStock?: boolean }): Promise<Product[]> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.lowStock) query['lowStock'] = 'true';
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
}
