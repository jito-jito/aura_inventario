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
  IonModal,
  IonThumbnail,
  IonSearchbar,
  IonSpinner,
  IonFab,
  IonFabButton,
  IonAccordionGroup,
  IonAccordion,
  IonCheckbox,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline, checkmarkCircle, alertCircle } from 'ionicons/icons';
import { MlListingsService } from '../../../core/ml-listings.service';
import { ProductsService } from '../../../core/products.service';
import { MlSearchItem, MlSearchItemVariation } from '../../../core/models/ml-listing.model';
import { Product } from '../../../core/models/product.model';

interface ComponentRow {
  productId: string | null;
  quantityPerUnit: number;
}

type VariationFieldStatus = 'empty' | 'unknown' | 'none' | 'available';

interface VariationFieldState {
  status: VariationFieldStatus;
  variations: MlSearchItemVariation[];
}

type BulkRowStatus = 'idle' | 'saving' | 'done' | 'error';

interface BulkRow {
  item: MlSearchItem;
  nombre: string;
  medida: string;
  finalName: string;
  finalSku: string;
  cost: number | null;
  stock: number | null;
  minStock: number | null;
  /** Variaciones nativas marcadas para vincular al mismo producto (solo aplica si item.variations no está vacío). */
  selectedVariationIds: Set<string>;
  status: BulkRowStatus;
  errorMessage: string | null;
}

/** Busca un patrón "30x40" en el título de la publicación para prellenar la medida. */
function extractMedida(title: string): string {
  const match = title.match(/(\d{1,4})\s*[x×]\s*(\d{1,4})/i);
  return match ? `${match[1]}x${match[2]}` : '';
}

/** Normaliza texto libre a un slug apto para SKU (sin acentos, minúsculas, guiones). */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

@Component({
  selector: 'app-ml-integration-unlinked-publications',
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
    IonModal,
    IonThumbnail,
    IonSearchbar,
    IonSpinner,
    IonFab,
    IonFabButton,
    IonAccordionGroup,
    IonAccordion,
    IonCheckbox,
  ],
  templateUrl: './unlinked-publications.html',
  styleUrl: './unlinked-publications.scss',
})
export class MlIntegrationUnlinkedPublications implements OnInit {
  products = signal<Product[]>([]);
  errorMessage = signal<string | null>(null);
  saving = signal(false);
  showForm = signal(false);

  myListings = signal<MlSearchItem[]>([]);
  loadingMyListings = signal(false);
  myListingsError = signal<string | null>(null);
  listingsFilter = signal('');
  selectedMlItem = signal<MlSearchItem | null>(null);
  preselectedItem = signal<MlSearchItem | null>(null);

  titleFilter = signal('');
  mlIdFilter = signal('');
  priceMin = signal<number | null>(null);
  priceMax = signal<number | null>(null);

  selectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());

  showBulkForm = signal(false);
  bulkNamePrefix = signal('');
  bulkSkuSlug = signal('');
  bulkUseSharedValues = signal(true);
  bulkSharedCost = signal<number | null>(null);
  bulkSharedStock = signal<number | null>(0);
  bulkSharedMinStock = signal<number | null>(5);
  bulkRows = signal<BulkRow[]>([]);
  bulkSubmitting = signal(false);

  form: { mlItemId: string; mlVariationId: string; components: ComponentRow[] } = {
    mlItemId: '',
    mlVariationId: '',
    components: [{ productId: null, quantityPerUnit: 1 }],
  };

  showProductPicker = signal(false);
  productPickerFilter = signal('');
  private activeComponentIndex: number | null = null;

  constructor(
    private readonly mlListingsService: MlListingsService,
    private readonly productsService: ProductsService,
  ) {
    addIcons({ addOutline, trashOutline, checkmarkCircle, alertCircle });
  }

  async ngOnInit(): Promise<void> {
    this.products.set(await this.productsService.findAll());
    await this.loadMyListings();
  }

  unlinkedMlPublications(): MlSearchItem[] {
    const titleTerm = this.titleFilter().trim().toLowerCase();
    const idTerm = this.mlIdFilter().trim().toLowerCase();
    const min = this.priceMin();
    const max = this.priceMax();

    return this.myListings().filter((item) => {
      if (item.alreadyLinked) return false;
      if (titleTerm && !item.title.toLowerCase().includes(titleTerm)) return false;
      if (idTerm && !item.id.toLowerCase().includes(idTerm)) return false;
      if (min != null && (item.price == null || item.price < min)) return false;
      if (max != null && (item.price == null || item.price > max)) return false;
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

  filteredMyListings(): MlSearchItem[] {
    const term = this.listingsFilter().trim().toLowerCase();
    let items = term
      ? this.myListings().filter((item) => item.title.toLowerCase().includes(term))
      : this.myListings();

    const preselected = this.preselectedItem();
    if (preselected) {
      items = [...items].sort((a, b) => {
        if (a.id === preselected.id) return -1;
        if (b.id === preselected.id) return 1;
        return 0;
      });
    }

    return items;
  }

  onFilterChange(value: string | null | undefined): void {
    this.listingsFilter.set(value ?? '');
  }

  async loadMyListings(): Promise<void> {
    this.loadingMyListings.set(true);
    this.myListingsError.set(null);
    try {
      this.myListings.set(await this.mlListingsService.searchMyListings());
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ??
        'No se pudieron traer tus publicaciones de Mercado Libre';
      this.myListingsError.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.loadingMyListings.set(false);
    }
  }

  openForm(): void {
    this.form = {
      mlItemId: '',
      mlVariationId: '',
      components: [{ productId: null, quantityPerUnit: 1 }],
    };
    this.errorMessage.set(null);
    this.selectedMlItem.set(null);
    this.preselectedItem.set(null);
    this.showForm.set(true);
  }

  openFormFor(item: MlSearchItem): void {
    this.openForm();
    this.selectMlItem(item);
    this.preselectedItem.set(item);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  selectMlItem(item: MlSearchItem): void {
    if (item.alreadyLinked) {
      return;
    }
    this.selectedMlItem.set(item);
    this.form.mlItemId = item.id;
    this.form.mlVariationId = item.variations.length === 1 ? item.variations[0].id : '';
  }

  /**
   * Busca las variaciones de la publicación actualmente cargada en el formulario
   * (venga de haberla elegido en el buscador o de haber tipeado el ID a mano).
   */
  currentVariationState(): VariationFieldState {
    const id = this.form.mlItemId.trim();
    if (!id) {
      return { status: 'empty', variations: [] };
    }
    const item = this.myListings().find((i) => i.id === id) ?? null;
    if (!item) {
      return { status: 'unknown', variations: [] };
    }
    if (item.variations.length === 0) {
      return { status: 'none', variations: [] };
    }
    return { status: 'available', variations: item.variations };
  }

  addComponentRow(): void {
    this.form.components.push({ productId: null, quantityPerUnit: 1 });
  }

  removeComponentRow(index: number): void {
    this.form.components.splice(index, 1);
  }

  productName(productId: string | null): string | null {
    if (!productId) return null;
    const product = this.products().find((p) => p.id === productId);
    return product ? `${product.name} (${product.sku})` : null;
  }

  filteredProducts(): Product[] {
    const term = this.productPickerFilter().trim().toLowerCase();
    if (!term) return this.products();
    return this.products().filter((product) => product.name.toLowerCase().includes(term));
  }

  onProductPickerFilterChange(value: string | null | undefined): void {
    this.productPickerFilter.set(value ?? '');
  }

  openProductPicker(index: number): void {
    this.activeComponentIndex = index;
    this.productPickerFilter.set('');
    this.showProductPicker.set(true);
  }

  closeProductPicker(): void {
    this.showProductPicker.set(false);
    this.activeComponentIndex = null;
  }

  selectProduct(product: Product): void {
    if (this.activeComponentIndex != null) {
      this.form.components[this.activeComponentIndex].productId = product.id;
    }
    this.closeProductPicker();
  }

  /** true cuando la publicación cargada tiene variaciones nativas y todavía no se eligió cuál. */
  variationMissing(): boolean {
    const state = this.currentVariationState();
    return state.status === 'available' && !this.form.mlVariationId.trim();
  }

  canSubmitLink(): boolean {
    if (this.saving()) return false;
    if (!this.form.mlItemId.trim()) return false;
    if (!this.form.components.some((row) => row.productId)) return false;
    return !this.variationMissing();
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

    if (this.variationMissing()) {
      this.errorMessage.set(
        'Esta publicación tiene variaciones: elegí una en "Variación" antes de vincular, para que las ventas de esa variación descuenten el producto correcto.',
      );
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
      this.showForm.set(false);
      await this.loadMyListings();
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ??
        'No se pudo vincular la publicación';
      this.errorMessage.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.saving.set(false);
    }
  }

  toggleSelectionMode(): void {
    this.selectionMode.set(!this.selectionMode());
    this.selectedIds.set(new Set());
  }

  toggleSelected(itemId: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    this.selectedIds.set(next);
  }

  areAllVisibleSelected(): boolean {
    const visible = this.unlinkedMlPublications();
    return visible.length > 0 && visible.every((item) => this.selectedIds().has(item.id));
  }

  toggleSelectAll(): void {
    const visible = this.unlinkedMlPublications();
    const next = new Set(this.selectedIds());
    if (this.areAllVisibleSelected()) {
      visible.forEach((item) => next.delete(item.id));
    } else {
      visible.forEach((item) => next.add(item.id));
    }
    this.selectedIds.set(next);
  }

  private buildBulkRow(item: MlSearchItem): BulkRow {
    const medida = extractMedida(item.title);
    return {
      item,
      nombre: '',
      medida,
      finalName: `${this.bulkNamePrefix()} ${medida}`.trim(),
      finalSku: slugify(`${this.bulkSkuSlug()}-${medida}`),
      cost: null,
      stock: null,
      minStock: null,
      selectedVariationIds: new Set(
        item.variations.filter((v) => !v.alreadyLinked).map((v) => v.id),
      ),
      status: 'idle',
      errorMessage: null,
    };
  }

  openBulkForm(): void {
    const items = this.myListings().filter(
      (item) => !item.alreadyLinked && this.selectedIds().has(item.id),
    );
    this.bulkRows.set(items.map((item) => this.buildBulkRow(item)));
    this.bulkSharedCost.set(null);
    this.bulkSharedStock.set(0);
    this.bulkSharedMinStock.set(5);
    this.bulkUseSharedValues.set(true);
    this.showBulkForm.set(true);
  }

  closeBulkForm(): void {
    this.showBulkForm.set(false);
  }

  removeBulkRow(index: number): void {
    const rows = [...this.bulkRows()];
    const [removed] = rows.splice(index, 1);
    this.bulkRows.set(rows);

    if (removed) {
      const next = new Set(this.selectedIds());
      next.delete(removed.item.id);
      this.selectedIds.set(next);
    }
  }

  private regenerateRow(row: BulkRow): BulkRow {
    return {
      ...row,
      finalName: `${this.bulkNamePrefix()} ${row.nombre} - ${row.medida}`.trim(),
      finalSku: slugify(`${this.bulkSkuSlug()}-${row.nombre}-${row.medida}`),
    };
  }

  private updateRow(index: number, patch: Partial<BulkRow>): void {
    const rows = [...this.bulkRows()];
    rows[index] = this.regenerateRow({ ...rows[index], ...patch });
    this.bulkRows.set(rows);
  }

  onBulkPrefixOrSlugChange(): void {
    this.bulkRows.set(this.bulkRows().map((row) => this.regenerateRow(row)));
  }

  onSharedCostChange(value: string | number | null | undefined): void {
    this.bulkSharedCost.set(value === '' || value == null ? null : Number(value));
  }

  onSharedStockChange(value: string | number | null | undefined): void {
    this.bulkSharedStock.set(value === '' || value == null ? null : Number(value));
  }

  onSharedMinStockChange(value: string | number | null | undefined): void {
    this.bulkSharedMinStock.set(value === '' || value == null ? null : Number(value));
  }

  onRowNombreChange(index: number, value: string | null | undefined): void {
    this.updateRow(index, { nombre: value ?? '' });
  }

  onRowMedidaChange(index: number, value: string | null | undefined): void {
    this.updateRow(index, { medida: value ?? '' });
  }

  onRowFinalNameChange(index: number, value: string | null | undefined): void {
    const rows = [...this.bulkRows()];
    rows[index] = { ...rows[index], finalName: value ?? '' };
    this.bulkRows.set(rows);
  }

  onRowFinalSkuChange(index: number, value: string | null | undefined): void {
    const rows = [...this.bulkRows()];
    rows[index] = { ...rows[index], finalSku: value ?? '' };
    this.bulkRows.set(rows);
  }

  onRowCostChange(index: number, value: string | number | null | undefined): void {
    const rows = [...this.bulkRows()];
    rows[index] = { ...rows[index], cost: value === '' || value == null ? null : Number(value) };
    this.bulkRows.set(rows);
  }

  onRowStockChange(index: number, value: string | number | null | undefined): void {
    const rows = [...this.bulkRows()];
    rows[index] = { ...rows[index], stock: value === '' || value == null ? null : Number(value) };
    this.bulkRows.set(rows);
  }

  onRowMinStockChange(index: number, value: string | number | null | undefined): void {
    const rows = [...this.bulkRows()];
    rows[index] = { ...rows[index], minStock: value === '' || value == null ? null : Number(value) };
    this.bulkRows.set(rows);
  }

  toggleRowVariation(index: number, variationId: string, checked: boolean): void {
    const rows = [...this.bulkRows()];
    const next = new Set(rows[index].selectedVariationIds);
    if (checked) {
      next.add(variationId);
    } else {
      next.delete(variationId);
    }
    rows[index] = { ...rows[index], selectedVariationIds: next };
    this.bulkRows.set(rows);
  }

  rowVariationMissing(row: BulkRow): boolean {
    return row.item.variations.length > 0 && row.selectedVariationIds.size === 0;
  }

  rowNombreMissing(row: BulkRow): boolean {
    return !row.nombre.trim();
  }

  rowMedidaMissing(row: BulkRow): boolean {
    return !row.medida.trim();
  }

  rowFinalNameMissing(row: BulkRow): boolean {
    return !row.finalName.trim();
  }

  rowFinalSkuMissing(row: BulkRow): boolean {
    return !row.finalSku.trim();
  }

  rowCostMissing(row: BulkRow): boolean {
    return !this.bulkUseSharedValues() && row.cost == null;
  }

  /** true si a esta fila le falta algún campo obligatorio (los marcados en rojo en el formulario). */
  rowHasMissingFields(row: BulkRow): boolean {
    return (
      this.rowNombreMissing(row) ||
      this.rowMedidaMissing(row) ||
      this.rowFinalNameMissing(row) ||
      this.rowFinalSkuMissing(row) ||
      this.rowCostMissing(row) ||
      this.rowVariationMissing(row)
    );
  }

  bulkRowsWithMissingFieldsCount(): number {
    return this.bulkRows().filter((row) => this.rowHasMissingFields(row)).length;
  }

  /** Razones legibles por las que el botón de carga masiva está bloqueado, para mostrar sin tener que buscar fila por fila. */
  bulkBlockedReasons(): string[] {
    const reasons: string[] = [];
    if (this.bulkUseSharedValues() && this.bulkSharedCost() == null) {
      reasons.push('Falta ingresar el costo compartido (arriba) para poder cargar los productos.');
    }
    const missingCount = this.bulkRowsWithMissingFieldsCount();
    if (missingCount === 1) {
      reasons.push('Hay 1 publicación con campos pendientes (marcados en rojo más abajo).');
    } else if (missingCount > 1) {
      reasons.push(
        `Hay ${missingCount} publicaciones con campos pendientes (marcados en rojo más abajo).`,
      );
    }
    return reasons;
  }

  bulkCanSubmit(): boolean {
    if (this.bulkSubmitting() || this.bulkRows().length === 0) return false;
    if (this.bulkRows().some((row) => this.rowHasMissingFields(row))) return false;
    return this.bulkUseSharedValues() ? this.bulkSharedCost() != null : true;
  }

  bulkPendingCount(): number {
    return this.bulkRows().filter((row) => row.status !== 'done').length;
  }

  bulkDoneCount(): number {
    return this.bulkRows().filter((row) => row.status === 'done').length;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: string } })?.error?.message ?? fallback;
    return Array.isArray(message) ? message.join(', ') : message;
  }

  /**
   * SKU (ya trimeado) -> id de producto, precargado con los productos existentes.
   * Se completa a medida que se crean productos nuevos durante el envío, así dos filas
   * del mismo lote que generan el mismo SKU reutilizan el producto recién creado por la primera.
   */
  private buildSkuToProductIdMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const product of this.products()) {
      map.set(product.sku.trim(), product.id);
    }
    return map;
  }

  /** true si el SKU de esta fila ya existe como producto o se repite en otra fila del lote. */
  rowSkuIsDuplicate(row: BulkRow): boolean {
    const sku = row.finalSku.trim();
    if (!sku) return false;
    if (this.products().some((product) => product.sku.trim() === sku)) return true;
    return this.bulkRows().some((other) => other !== row && other.finalSku.trim() === sku);
  }

  async submitBulk(): Promise<void> {
    this.bulkSubmitting.set(true);
    const rows = this.bulkRows();
    const skuToProductId = this.buildSkuToProductIdMap();

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === 'done') continue;

      this.updateRow(i, { status: 'saving', errorMessage: null });
      const row = this.bulkRows()[i];
      try {
        const sku = row.finalSku.trim();
        let productId = skuToProductId.get(sku);

        if (!productId) {
          const cost = this.bulkUseSharedValues() ? this.bulkSharedCost() : row.cost;
          const stock = this.bulkUseSharedValues() ? this.bulkSharedStock() : row.stock;
          const minStock = this.bulkUseSharedValues() ? this.bulkSharedMinStock() : row.minStock;

          const product = await this.productsService.create({
            sku,
            name: row.finalName,
            cost: cost ?? 0,
            stock: stock ?? undefined,
            minStock: minStock ?? undefined,
          });
          productId = product.id;
          skuToProductId.set(sku, productId);
        }

        if (row.item.variations.length > 0) {
          // Un vínculo por cada variación marcada, todos apuntando al mismo producto (nuevo o reutilizado).
          for (const variationId of row.selectedVariationIds) {
            await this.mlListingsService.create({
              mlItemId: row.item.id,
              mlVariationId: variationId,
              components: [{ productId, quantityPerUnit: 1 }],
            });
          }
        } else {
          await this.mlListingsService.create({
            mlItemId: row.item.id,
            components: [{ productId, quantityPerUnit: 1 }],
          });
        }
        this.updateRow(i, { status: 'done', errorMessage: null });
      } catch (error) {
        this.updateRow(i, {
          status: 'error',
          errorMessage: this.extractErrorMessage(error, 'No se pudo crear/vincular este producto'),
        });
      }
    }

    this.bulkSubmitting.set(false);
    await Promise.all([this.loadMyListings(), this.refreshProducts()]);
  }

  private async refreshProducts(): Promise<void> {
    this.products.set(await this.productsService.findAll());
  }
}
