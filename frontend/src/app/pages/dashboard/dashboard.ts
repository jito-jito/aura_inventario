import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonNote,
  IonButton,
} from '@ionic/angular/standalone';
import { ProductsService } from '../../core/products.service';
import { MlOrdersService } from '../../core/ml-orders.service';
import { MonitoringService } from '../../core/monitoring.service';
import { Product } from '../../core/models/product.model';
import { MlProcessedOrderItem } from '../../core/models/ml-processed-order-item.model';
import { IntegrationErrorItem, IntegrationErrorType } from '../../core/models/integration-error.model';

const LOW_STOCK_PREVIEW_LIMIT = 3;

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const ERROR_TYPE_LABELS: Record<IntegrationErrorType, string> = {
  ml_connection: 'Conexión Mercado Libre',
  ml_listing: 'Publicación vinculada',
  order_processing: 'Procesamiento de venta',
  order_fetch: 'Consulta de orden a Mercado Libre',
};

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonNote,
    IonButton,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  loading = signal(true);
  lowStockProducts = signal<Product[]>([]);
  lowStockPreview = computed(() => this.lowStockProducts().slice(0, LOW_STOCK_PREVIEW_LIMIT));
  todaySales = signal<MlProcessedOrderItem[]>([]);
  errors = signal<IntegrationErrorItem[]>([]);

  constructor(
    private readonly productsService: ProductsService,
    private readonly mlOrdersService: MlOrdersService,
    private readonly monitoringService: MonitoringService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const today = todayIsoDate();
      const [lowStock, todaySales, errors] = await Promise.all([
        this.productsService.findAll({ stockStatus: 'critical' }),
        this.mlOrdersService.findProcessed({ dateFrom: today, dateTo: today }),
        this.monitoringService.getErrors(),
      ]);
      this.lowStockProducts.set(lowStock);
      this.todaySales.set(todaySales);
      this.errors.set(errors);
    } finally {
      this.loading.set(false);
    }
  }

  errorTypeLabel(type: IntegrationErrorType): string {
    return ERROR_TYPE_LABELS[type];
  }
}
