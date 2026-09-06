import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonBadge,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
} from '@ionic/angular/standalone';
import { MlListingsService } from '../../core/ml-listings.service';
import { MlConnectionService } from '../../core/ml-connection.service';
import { MlConnectionStatus } from '../../core/models/ml-connection.model';

@Component({
  selector: 'app-ml-integration',
  imports: [
    DatePipe,
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonBadge,
    IonItem,
    IonLabel,
    IonSpinner,
    IonText,
  ],
  templateUrl: './ml-integration.html',
  styleUrl: './ml-integration.scss',
})
export class MlIntegration implements OnInit {
  // Conexión con Mercado Libre
  connectionStatus = signal<MlConnectionStatus | null>(null);
  loadingConnection = signal(true);
  connecting = signal(false);
  callbackMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reporte de publicaciones/productos
  loadingCatalog = signal(true);
  unlinkedProductsCount = signal(0);
  linkedCount = signal(0);

  loadingPublications = signal(true);
  unlinkedPublicationsCount = signal(0);
  publicationsError = signal<string | null>(null);

  constructor(
    private readonly mlListingsService: MlListingsService,
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

    await this.loadConnectionStatus();
    this.loadCatalogCounts();
    this.loadPublicationsCount();
  }

  async loadConnectionStatus(): Promise<void> {
    this.loadingConnection.set(true);
    try {
      this.connectionStatus.set(await this.mlConnectionService.getStatus());
    } finally {
      this.loadingConnection.set(false);
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
    this.loadingConnection.set(true);
    try {
      await this.mlConnectionService.disconnect();
      await this.loadConnectionStatus();
    } finally {
      this.loadingConnection.set(false);
    }
  }

  private async loadCatalogCounts(): Promise<void> {
    this.loadingCatalog.set(true);
    try {
      const [unlinkedProducts, listings] = await Promise.all([
        this.mlListingsService.findUnlinkedProducts(),
        this.mlListingsService.findAll(),
      ]);
      this.unlinkedProductsCount.set(unlinkedProducts.length);
      this.linkedCount.set(listings.length);
    } finally {
      this.loadingCatalog.set(false);
    }
  }

  private async loadPublicationsCount(): Promise<void> {
    this.loadingPublications.set(true);
    this.publicationsError.set(null);
    try {
      const myListings = await this.mlListingsService.searchMyListings();
      this.unlinkedPublicationsCount.set(myListings.filter((item) => !item.alreadyLinked).length);
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ??
        'No se pudieron traer tus publicaciones de Mercado Libre';
      this.publicationsError.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.loadingPublications.set(false);
    }
  }
}
