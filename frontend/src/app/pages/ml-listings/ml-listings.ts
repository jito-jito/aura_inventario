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
  IonIcon,
  IonList,
  IonBadge,
  IonText,
  IonChip,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline } from 'ionicons/icons';
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

interface ComponentRow {
  productId: string | null;
  quantityPerUnit: number;
}

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
    IonIcon,
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

  form: { mlItemId: string; mlVariationId: string; components: ComponentRow[] } = {
    mlItemId: '',
    mlVariationId: '',
    components: [{ productId: null, quantityPerUnit: 1 }],
  };

  constructor(
    private readonly mlListingsService: MlListingsService,
    private readonly productsService: ProductsService,
    private readonly alertController: AlertController,
  ) {
    addIcons({ addOutline, trashOutline });
  }

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

  addComponentRow(): void {
    this.form.components.push({ productId: null, quantityPerUnit: 1 });
  }

  removeComponentRow(index: number): void {
    this.form.components.splice(index, 1);
  }

  async link(): Promise<void> {
    const components = this.form.components
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId as string,
        quantityPerUnit: row.quantityPerUnit || 1,
      }));

    if (!this.form.mlItemId.trim() || components.length === 0) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await this.mlListingsService.create({
        mlItemId: this.form.mlItemId.trim(),
        mlVariationId: this.form.mlVariationId.trim() || undefined,
        components,
      });
      this.form = {
        mlItemId: '',
        mlVariationId: '',
        components: [{ productId: null, quantityPerUnit: 1 }],
      };
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

  componentsSummary(listing: MlListing): string {
    return listing.components
      .map((c) => `${c.product.name} (${c.product.sku}) ×${c.quantityPerUnit}`)
      .join(' + ');
  }

  async unlink(listing: MlListing): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Desvincular publicación',
      message: `¿Desvincular "${listing.title ?? listing.mlItemId}" (${this.componentsSummary(listing)})?`,
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
