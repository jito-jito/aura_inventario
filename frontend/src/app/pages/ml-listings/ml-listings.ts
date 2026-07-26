import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
  IonList,
  IonBadge,
  IonText,
  IonChip,
  AlertController,
} from '@ionic/angular/standalone';
import { MlListingsService } from '../../core/ml-listings.service';
import { ProductsService } from '../../core/products.service';
import { MlListing, MlListingSyncStatus } from '../../core/models/ml-listing.model';
import { Product } from '../../core/models/product.model';

const STATUS_LABELS: Record<MlListingSyncStatus, string> = {
  pending: 'Pendiente',
  synced: 'Sincronizado',
  error: 'Error',
};

const STATUS_COLORS: Record<MlListingSyncStatus, string> = {
  pending: 'medium',
  synced: 'success',
  error: 'danger',
};

@Component({
  selector: 'app-ml-listings',
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonButton,
    IonList,
    IonBadge,
    IonText,
    IonChip,
  ],
  templateUrl: './ml-listings.html',
  styleUrl: './ml-listings.scss',
})
export class MlListings implements OnInit {
  listings = signal<MlListing[]>([]);
  products = signal<Product[]>([]);
  unlinkedProducts = signal<Product[]>([]);
  errorMessage = signal<string | null>(null);
  saving = signal(false);

  form: { productId: string | null; mlItemId: string; mlVariationId: string } = {
    productId: null,
    mlItemId: '',
    mlVariationId: '',
  };

  constructor(
    private readonly mlListingsService: MlListingsService,
    private readonly productsService: ProductsService,
    private readonly alertController: AlertController,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    const [listings, products, unlinked] = await Promise.all([
      this.mlListingsService.findAll(),
      this.productsService.findAll(),
      this.mlListingsService.findUnlinkedProducts(),
    ]);
    this.listings.set(listings);
    this.products.set(products);
    this.unlinkedProducts.set(unlinked);
  }

  statusLabel(status: MlListingSyncStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: MlListingSyncStatus): string {
    return STATUS_COLORS[status];
  }

  async link(): Promise<void> {
    if (!this.form.productId || !this.form.mlItemId.trim()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await this.mlListingsService.create({
        productId: this.form.productId,
        mlItemId: this.form.mlItemId.trim(),
        mlVariationId: this.form.mlVariationId.trim() || undefined,
      });
      this.form = { productId: null, mlItemId: '', mlVariationId: '' };
      await this.loadAll();
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ??
        'No se pudo vincular la publicación';
      this.errorMessage.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.saving.set(false);
    }
  }

  async unlink(listing: MlListing): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Desvincular publicación',
      message: `¿Desvincular "${listing.title ?? listing.mlItemId}" del producto ${listing.product.name}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desvincular',
          role: 'destructive',
          handler: async () => {
            await this.mlListingsService.remove(listing.id);
            await this.loadAll();
          },
        },
      ],
    });
    await alert.present();
  }
}
