import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonText,
  IonSpinner,
} from '@ionic/angular/standalone';
import { MlConnectionService } from '../../core/ml-connection.service';
import { MlConnectionStatus } from '../../core/models/ml-connection.model';

@Component({
  selector: 'app-ml-connection',
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonBadge,
    IonButton,
    IonItem,
    IonLabel,
    IonText,
    IonSpinner,
  ],
  templateUrl: './ml-connection.html',
  styleUrl: './ml-connection.scss',
})
export class MlConnection implements OnInit {
  status = signal<MlConnectionStatus | null>(null);
  loading = signal(true);
  connecting = signal(false);
  callbackMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  constructor(
    private readonly mlConnectionService: MlConnectionService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const callbackStatus = params.get('status');
    if (callbackStatus === 'success') {
      this.callbackMessage.set({ type: 'success', text: 'Cuenta de Mercado Libre conectada correctamente.' });
    } else if (callbackStatus === 'error') {
      this.callbackMessage.set({
        type: 'error',
        text: params.get('message') || 'No se pudo conectar con Mercado Libre.',
      });
    }
    if (callbackStatus) {
      await this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }

    await this.loadStatus();
  }

  async loadStatus(): Promise<void> {
    this.loading.set(true);
    try {
      this.status.set(await this.mlConnectionService.getStatus());
    } finally {
      this.loading.set(false);
    }
  }

  async connect(): Promise<void> {
    this.connecting.set(true);
    try {
      const url = await this.mlConnectionService.getAuthorizationUrl();
      window.location.href = url;
    } finally {
      this.connecting.set(false);
    }
  }

  async disconnect(): Promise<void> {
    this.loading.set(true);
    try {
      await this.mlConnectionService.disconnect();
      await this.loadStatus();
    } finally {
      this.loading.set(false);
    }
  }
}
