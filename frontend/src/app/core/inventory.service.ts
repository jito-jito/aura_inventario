import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateMovementPayload, InventoryMovement } from './models/inventory-movement.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly baseUrl = `${environment.apiUrl}/inventory`;

  constructor(private readonly http: HttpClient) {}

  registerMovement(payload: CreateMovementPayload): Promise<InventoryMovement> {
    return firstValueFrom(this.http.post<InventoryMovement>(`${this.baseUrl}/movements`, payload));
  }

  findByProduct(productId: string): Promise<InventoryMovement[]> {
    return firstValueFrom(
      this.http.get<InventoryMovement[]>(`${this.baseUrl}/movements`, {
        params: { productId },
      }),
    );
  }
}
