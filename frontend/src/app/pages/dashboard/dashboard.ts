import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
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
} from '@ionic/angular/standalone';
import { ProductsService } from '../../core/products.service';
import { MlOrdersService } from '../../core/ml-orders.service';
import { MonitoringService } from '../../core/monitoring.service';
import { Product } from '../../core/models/product.model';
import { MlProcessedOrderItem } from '../../core/models/ml-processed-order-item.model';
import { IntegrationErrorItem, IntegrationErrorType } from '../../core/models/integration-error.model';

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
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  loading = signal(true);
  lowStockProducts = signal<Product[]>([]);
  recentSales = signal<MlProcessedOrderItem[]>([]);
  errors = signal<IntegrationErrorItem[]>([]);

  constructor(
    private readonly productsService: ProductsService,
    private readonly mlOrdersService: MlOrdersService,
    private readonly monitoringService: MonitoringService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [lowStock, recentSales, errors] = await Promise.all([
        this.productsService.findAll({ stockStatus: 'critical' }),
        this.mlOrdersService.findRecentlyProcessed(),
        this.monitoringService.getErrors(),
      ]);
      this.lowStockProducts.set(lowStock);
      this.recentSales.set(recentSales);
      this.errors.set(errors);
    } finally {
      this.loading.set(false);
    }
  }

  errorTypeLabel(type: IntegrationErrorType): string {
    return ERROR_TYPE_LABELS[type];
  }
}
