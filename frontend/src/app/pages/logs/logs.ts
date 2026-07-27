import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonButton,
} from '@ionic/angular/standalone';
import { MonitoringService } from '../../core/monitoring.service';
import { IntegrationErrorItem, IntegrationErrorType } from '../../core/models/integration-error.model';

const ERROR_TYPE_LABELS: Record<IntegrationErrorType, string> = {
  ml_connection: 'Conexión Mercado Libre',
  ml_listing: 'Publicación vinculada',
  order_processing: 'Procesamiento de venta',
};

@Component({
  selector: 'app-logs',
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonSpinner,
    IonButton,
  ],
  templateUrl: './logs.html',
  styleUrl: './logs.scss',
})
export class Logs implements OnInit {
  loading = signal(true);
  errors = signal<IntegrationErrorItem[]>([]);

  constructor(private readonly monitoringService: MonitoringService) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.errors.set(await this.monitoringService.getErrors());
    } finally {
      this.loading.set(false);
    }
  }

  errorTypeLabel(type: IntegrationErrorType): string {
    return ERROR_TYPE_LABELS[type];
  }
}
