import { Component, OnInit, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
} from '@ionic/angular/standalone';
import { MlListingsService } from '../../../core/ml-listings.service';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-ml-integration-unlinked-products',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
  ],
  templateUrl: './unlinked-products.html',
  styleUrl: './unlinked-products.scss',
})
export class MlIntegrationUnlinkedProducts implements OnInit {
  loading = signal(true);
  unlinkedProducts = signal<Product[]>([]);
  searchTerm = signal('');
  stockStatus = signal<'critical' | 'ok' | ''>('');
  sortByStock = signal<'asc' | 'desc' | ''>('');

  constructor(private readonly mlListingsService: MlListingsService) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.unlinkedProducts.set(
        await this.mlListingsService.findUnlinkedProducts({
          search: this.searchTerm(),
          stockStatus: this.stockStatus() || undefined,
          sortByStock: this.sortByStock() || undefined,
        }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string | null | undefined): void {
    this.searchTerm.set(value ?? '');
    this.load();
  }

  onStockStatusChange(value: string | null | undefined): void {
    this.stockStatus.set(value === 'critical' || value === 'ok' ? value : '');
    this.load();
  }

  onSortByStockChange(value: string | null | undefined): void {
    this.sortByStock.set((value as 'asc' | 'desc' | null) ?? '');
    this.load();
  }

  isLowStock(product: Product): boolean {
    return product.stock <= product.minStock;
  }
}
