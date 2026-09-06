import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonButton,
  IonChip,
  IonThumbnail,
  IonInput,
  IonSpinner,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonText,
  IonCheckbox,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline, checkmarkCircle, alertCircle } from 'ionicons/icons';
import { MlListingsService } from '../../../core/ml-listings.service';
import { ProductsService } from '../../../core/products.service';
import { MlListing, MlListingSyncStatus } from '../../../core/models/ml-listing.model';
import { Product } from '../../../core/models/product.model';

interface ComponentRow {
  productId: string | null;
  quantityPerUnit: number;
}

type BulkAddRowStatus = 'idle' | 'saving' | 'done' | 'error';

interface BulkAddRow {
  listing: MlListing;
  status: BulkAddRowStatus;
  errorMessage: string | null;
}

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
  selector: 'app-ml-integration-linked',
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonButton,
    IonChip,
    IonThumbnail,
    IonInput,
    IonSpinner,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonText,
    IonCheckbox,
  ],
  templateUrl: './linked.html',
  styleUrl: './linked.scss',
})
export class MlIntegrationLinked implements OnInit {
  loading = signal(true);
  listings = signal<MlListing[]>([]);
  products = signal<Product[]>([]);

  titleFilter = signal('');
  mlIdFilter = signal('');
  priceMin = signal<number | null>(null);
  priceMax = signal<number | null>(null);

  showEditForm = signal(false);
  editingListing = signal<MlListing | null>(null);
  editSaving = signal(false);
  editError = signal<string | null>(null);
  editComponents: ComponentRow[] = [];

  selectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());

  showBulkAddForm = signal(false);
  bulkAddProductId = signal<string | null>(null);
  bulkAddQuantity = signal(1);
  bulkAddRows = signal<BulkAddRow[]>([]);
  bulkAddSubmitting = signal(false);

  constructor(
    private readonly mlListingsService: MlListingsService,
    private readonly productsService: ProductsService,
    private readonly alertController: AlertController,
  ) {
    addIcons({ addOutline, trashOutline, checkmarkCircle, alertCircle });
  }

  async ngOnInit(): Promise<void> {
    this.products.set(await this.productsService.findAll());
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.listings.set(await this.mlListingsService.findAll());
    } finally {
      this.loading.set(false);
    }
  }

  filteredListings(): MlListing[] {
    const titleTerm = this.titleFilter().trim().toLowerCase();
    const idTerm = this.mlIdFilter().trim().toLowerCase();
    const min = this.priceMin();
    const max = this.priceMax();

    return this.listings().filter((listing) => {
      if (titleTerm && !(listing.title ?? listing.mlItemId).toLowerCase().includes(titleTerm)) {
        return false;
      }
      if (idTerm && !listing.mlItemId.toLowerCase().includes(idTerm)) return false;
      if (min != null && (listing.price == null || listing.price < min)) return false;
      if (max != null && (listing.price == null || listing.price > max)) return false;
      return true;
    });
  }

  onTitleFilterChange(value: string | null | undefined): void {
    this.titleFilter.set(value ?? '');
  }

  onMlIdFilterChange(value: string | null | undefined): void {
    this.mlIdFilter.set(value ?? '');
  }

  onPriceMinChange(value: string | number | null | undefined): void {
    this.priceMin.set(value === '' || value == null ? null : Number(value));
  }

  onPriceMaxChange(value: string | number | null | undefined): void {
    this.priceMax.set(value === '' || value == null ? null : Number(value));
  }

  statusLabel(status: MlListingSyncStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: MlListingSyncStatus): string {
    return STATUS_COLORS[status];
  }

  componentsSummary(listing: MlListing): string {
    return listing.components
      .map((c) => `${c.product.name} (${c.product.sku}) ×${c.quantityPerUnit}`)
      .join(' + ');
  }

  openEdit(listing: MlListing): void {
    this.editingListing.set(listing);
    this.editComponents = listing.components.map((c) => ({
      productId: c.productId,
      quantityPerUnit: c.quantityPerUnit,
    }));
    if (this.editComponents.length === 0) {
      this.editComponents.push({ productId: null, quantityPerUnit: 1 });
    }
    this.editError.set(null);
    this.showEditForm.set(true);
  }

  closeEdit(): void {
    this.showEditForm.set(false);
  }

  addEditComponentRow(): void {
    this.editComponents.push({ productId: null, quantityPerUnit: 1 });
  }

  removeEditComponentRow(index: number): void {
    this.editComponents.splice(index, 1);
  }

  async saveEdit(): Promise<void> {
    const listing = this.editingListing();
    if (!listing) return;

    const components = this.editComponents
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId as string,
        quantityPerUnit: row.quantityPerUnit || 1,
      }));

    if (components.length === 0) {
      this.editError.set('Agregá al menos un producto');
      return;
    }

    this.editSaving.set(true);
    this.editError.set(null);
    try {
      await this.mlListingsService.updateComponents(listing.id, components);
      this.showEditForm.set(false);
      await this.load();
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ??
        'No se pudieron guardar los cambios';
      this.editError.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.editSaving.set(false);
    }
  }

  toggleSelectionMode(): void {
    this.selectionMode.set(!this.selectionMode());
    this.selectedIds.set(new Set());
  }

  toggleSelected(listingId: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(listingId)) {
      next.delete(listingId);
    } else {
      next.add(listingId);
    }
    this.selectedIds.set(next);
  }

  areAllVisibleSelected(): boolean {
    const visible = this.filteredListings();
    return visible.length > 0 && visible.every((listing) => this.selectedIds().has(listing.id));
  }

  toggleSelectAll(): void {
    const visible = this.filteredListings();
    const next = new Set(this.selectedIds());
    if (this.areAllVisibleSelected()) {
      visible.forEach((listing) => next.delete(listing.id));
    } else {
      visible.forEach((listing) => next.add(listing.id));
    }
    this.selectedIds.set(next);
  }

  openBulkAddForm(): void {
    const rows = this.listings()
      .filter((listing) => this.selectedIds().has(listing.id))
      .map((listing) => ({ listing, status: 'idle' as BulkAddRowStatus, errorMessage: null }));
    this.bulkAddRows.set(rows);
    this.bulkAddProductId.set(null);
    this.bulkAddQuantity.set(1);
    this.showBulkAddForm.set(true);
  }

  closeBulkAddForm(): void {
    this.showBulkAddForm.set(false);
  }

  onBulkAddQuantityChange(value: string | number | null | undefined): void {
    this.bulkAddQuantity.set(value === '' || value == null ? 1 : Number(value));
  }

  bulkAddCanSubmit(): boolean {
    return (
      !this.bulkAddSubmitting() && this.bulkAddRows().length > 0 && !!this.bulkAddProductId()
    );
  }

  bulkAddPendingCount(): number {
    return this.bulkAddRows().filter((row) => row.status !== 'done').length;
  }

  bulkAddDoneCount(): number {
    return this.bulkAddRows().filter((row) => row.status === 'done').length;
  }

  private updateBulkAddRow(index: number, patch: Partial<BulkAddRow>): void {
    const rows = [...this.bulkAddRows()];
    rows[index] = { ...rows[index], ...patch };
    this.bulkAddRows.set(rows);
  }

  async submitBulkAdd(): Promise<void> {
    const productId = this.bulkAddProductId();
    if (!productId) return;

    const quantityPerUnit = this.bulkAddQuantity() || 1;
    this.bulkAddSubmitting.set(true);
    const rows = this.bulkAddRows();

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === 'done') continue;

      this.updateBulkAddRow(i, { status: 'saving', errorMessage: null });
      const { listing } = this.bulkAddRows()[i];
      const components = listing.components.map((c) => ({
        productId: c.productId,
        quantityPerUnit: c.quantityPerUnit,
      }));
      const existing = components.find((c) => c.productId === productId);
      if (existing) {
        existing.quantityPerUnit = quantityPerUnit;
      } else {
        components.push({ productId, quantityPerUnit });
      }

      try {
        await this.mlListingsService.updateComponents(listing.id, components);
        this.updateBulkAddRow(i, { status: 'done', errorMessage: null });
      } catch (error) {
        const message =
          (error as { error?: { message?: string } })?.error?.message ??
          'No se pudo actualizar este vínculo';
        this.updateBulkAddRow(i, {
          status: 'error',
          errorMessage: Array.isArray(message) ? message.join(', ') : message,
        });
      }
    }

    this.bulkAddSubmitting.set(false);
    await this.load();
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
            await this.load();
          },
        },
      ],
    });
    await alert.present();
  }

  async unlinkSelected(): Promise<void> {
    const selected = this.listings().filter((listing) => this.selectedIds().has(listing.id));
    if (selected.length === 0) return;

    const alert = await this.alertController.create({
      header: 'Desvincular publicaciones',
      message: `¿Desvincular ${selected.length} publicación(es) seleccionada(s)? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desvincular',
          role: 'destructive',
          handler: async () => {
            await Promise.allSettled(
              selected.map((listing) => this.mlListingsService.remove(listing.id)),
            );
            this.selectionMode.set(false);
            this.selectedIds.set(new Set());
            await this.load();
          },
        },
      ],
    });
    await alert.present();
  }
}
