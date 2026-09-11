import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
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
  IonFab,
  IonFabButton,
  IonIcon,
  IonModal,
  IonButton,
  IonInput,
  IonText,
  IonNote,
  IonCheckbox,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  chevronDownOutline,
  chevronExpandOutline,
  chevronUpOutline,
  createOutline,
  swapVerticalOutline,
  trashOutline,
} from 'ionicons/icons';
import { ProductsService } from '../../core/products.service';
import { InventoryService } from '../../core/inventory.service';
import { Product } from '../../core/models/product.model';
import { InventoryMovement, MovementType } from '../../core/models/inventory-movement.model';

const MOVEMENT_LABELS: Record<MovementType, string> = {
  in: 'Entrada',
  out: 'Salida',
  adjustment: 'Ajuste',
};

type SortColumn = 'sku' | 'name' | 'description' | 'cost' | 'stock' | 'minStock';
type SortDirection = 'asc' | 'desc';

const COLUMN_COMPARATORS: Record<SortColumn, (product: Product) => string | number> = {
  sku: (product) => product.sku.toLowerCase(),
  name: (product) => product.name.toLowerCase(),
  description: (product) => (product.description ?? '').toLowerCase(),
  cost: (product) => Number(product.cost),
  stock: (product) => product.stock,
  minStock: (product) => product.minStock,
};

@Component({
  selector: 'app-products',
  imports: [
    DatePipe,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
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
    IonFab,
    IonFabButton,
    IonIcon,
    IonModal,
    IonButton,
    IonInput,
    IonText,
    IonNote,
    IonCheckbox,
  ],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products implements OnInit {
  products = signal<Product[]>([]);
  searchTerm = signal('');
  stockStatus = signal<'critical' | 'ok' | ''>('');
  sortByStock = signal<'asc' | 'desc' | ''>('');
  showForm = signal(false);
  editingProduct = signal<Product | null>(null);
  errorMessage = signal<string | null>(null);
  saving = signal(false);

  selectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());

  columnSort = signal<{ column: SortColumn; direction: SortDirection } | null>(null);
  sortedProducts = computed(() => {
    const sort = this.columnSort();
    const list = this.products();
    if (!sort) return list;

    const getValue = COLUMN_COMPARATORS[sort.column];
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const valueA = getValue(a);
      const valueB = getValue(b);
      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
      return 0;
    });
  });

  form = { sku: '', name: '', description: '', cost: 0, stock: 0, minStock: 5 };

  showMovementForm = signal(false);
  movementProduct = signal<Product | null>(null);
  movements = signal<InventoryMovement[]>([]);
  movementError = signal<string | null>(null);
  movementSaving = signal(false);
  movementForm: { type: MovementType; quantity: number | null; reason: string } = {
    type: 'in',
    quantity: null,
    reason: '',
  };

  constructor(
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
    private readonly alertController: AlertController,
  ) {
    addIcons({
      addOutline,
      chevronDownOutline,
      chevronExpandOutline,
      chevronUpOutline,
      createOutline,
      swapVerticalOutline,
      trashOutline,
    });
  }

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.products.set(
      await this.productsService.findAll({
        search: this.searchTerm(),
        stockStatus: this.stockStatus() || undefined,
        sortByStock: this.sortByStock() || undefined,
      }),
    );
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

  openCreateForm(): void {
    this.editingProduct.set(null);
    this.form = { sku: '', name: '', description: '', cost: 0, stock: 0, minStock: 5 };
    this.errorMessage.set(null);
    this.showForm.set(true);
  }

  openEditForm(product: Product): void {
    this.editingProduct.set(product);
    this.form = {
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      cost: Number(product.cost),
      stock: product.stock,
      minStock: product.minStock,
    };
    this.errorMessage.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const editing = this.editingProduct();
      if (editing) {
        await this.productsService.update(editing.id, {
          sku: this.form.sku,
          name: this.form.name,
          description: this.form.description,
          cost: this.form.cost,
          minStock: this.form.minStock,
        });
      } else {
        await this.productsService.create({
          sku: this.form.sku,
          name: this.form.name,
          description: this.form.description,
          cost: this.form.cost,
          stock: this.form.stock,
          minStock: this.form.minStock,
        });
      }
      this.showForm.set(false);
      await this.load();
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el producto';
      this.errorMessage.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.saving.set(false);
    }
  }

  isLowStock(product: Product): boolean {
    return product.stock <= product.minStock;
  }

  toggleColumnSort(column: SortColumn): void {
    const current = this.columnSort();
    if (current?.column !== column) {
      this.columnSort.set({ column, direction: 'asc' });
    } else if (current.direction === 'asc') {
      this.columnSort.set({ column, direction: 'desc' });
    } else {
      this.columnSort.set(null);
    }
  }

  columnSortIcon(column: SortColumn): string {
    const current = this.columnSort();
    if (current?.column !== column) return 'chevron-expand-outline';
    return current.direction === 'asc' ? 'chevron-up-outline' : 'chevron-down-outline';
  }

  toggleSelectionMode(): void {
    this.selectionMode.set(!this.selectionMode());
    this.selectedIds.set(new Set());
  }

  toggleSelected(productId: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    this.selectedIds.set(next);
  }

  areAllVisibleSelected(): boolean {
    const visible = this.products();
    return visible.length > 0 && visible.every((product) => this.selectedIds().has(product.id));
  }

  toggleSelectAll(): void {
    const visible = this.products();
    const next = new Set(this.selectedIds());
    if (this.areAllVisibleSelected()) {
      visible.forEach((product) => next.delete(product.id));
    } else {
      visible.forEach((product) => next.add(product.id));
    }
    this.selectedIds.set(next);
  }

  async deleteProduct(product: Product): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar producto',
      message: `¿Eliminar "${product.name}" (${product.sku})? Se perderá su historial de movimientos.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.productsService.remove(product.id);
            await this.load();
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteSelected(): Promise<void> {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;

    const alert = await this.alertController.create({
      header: 'Eliminar productos',
      message: `¿Eliminar ${ids.length} producto(s) seleccionado(s)? Se perderá su historial de movimientos.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await Promise.all(ids.map((id) => this.productsService.remove(id)));
            this.selectionMode.set(false);
            this.selectedIds.set(new Set());
            await this.load();
          },
        },
      ],
    });
    await alert.present();
  }

  movementLabel(type: MovementType): string {
    return MOVEMENT_LABELS[type];
  }

  async openMovementForm(product: Product): Promise<void> {
    this.movementProduct.set(product);
    this.movementForm = { type: 'in', quantity: null, reason: '' };
    this.movementError.set(null);
    this.showMovementForm.set(true);
    this.movements.set(await this.inventoryService.findByProduct(product.id));
  }

  closeMovementForm(): void {
    this.showMovementForm.set(false);
  }

  async registerMovement(): Promise<void> {
    const product = this.movementProduct();
    if (!product || !this.movementForm.quantity) {
      return;
    }

    this.movementSaving.set(true);
    this.movementError.set(null);
    try {
      await this.inventoryService.registerMovement({
        productId: product.id,
        type: this.movementForm.type,
        quantity: this.movementForm.quantity,
        reason: this.movementForm.reason || undefined,
      });
      this.movementForm = { type: 'in', quantity: null, reason: '' };
      const [movements] = await Promise.all([
        this.inventoryService.findByProduct(product.id),
        this.load(),
      ]);
      this.movements.set(movements);
      this.movementProduct.set(this.products().find((p) => p.id === product.id) ?? product);
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ??
        'No se pudo registrar el movimiento';
      this.movementError.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.movementSaving.set(false);
    }
  }
}
