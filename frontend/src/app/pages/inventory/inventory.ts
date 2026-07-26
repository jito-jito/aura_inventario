import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  IonNote,
  IonText,
} from '@ionic/angular/standalone';
import { ProductsService } from '../../core/products.service';
import { InventoryService } from '../../core/inventory.service';
import { Product } from '../../core/models/product.model';
import { InventoryMovement, MovementType } from '../../core/models/inventory-movement.model';

const MOVEMENT_LABELS: Record<MovementType, string> = {
  in: 'Entrada',
  out: 'Salida',
  adjustment: 'Ajuste',
};

@Component({
  selector: 'app-inventory',
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
    IonNote,
    IonText,
  ],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class Inventory implements OnInit {
  products = signal<Product[]>([]);
  selectedProductId = signal<string | null>(null);
  movements = signal<InventoryMovement[]>([]);
  errorMessage = signal<string | null>(null);
  saving = signal(false);

  form: { type: MovementType; quantity: number | null; reason: string } = {
    type: 'in',
    quantity: null,
    reason: '',
  };

  constructor(
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  async loadProducts(): Promise<void> {
    this.products.set(await this.productsService.findAll());
  }

  get selectedProduct(): Product | undefined {
    return this.products().find((p) => p.id === this.selectedProductId());
  }

  movementLabel(type: MovementType): string {
    return MOVEMENT_LABELS[type];
  }

  async onProductChange(productId: string | null): Promise<void> {
    this.selectedProductId.set(productId);
    this.errorMessage.set(null);
    if (!productId) {
      this.movements.set([]);
      return;
    }
    this.movements.set(await this.inventoryService.findByProduct(productId));
  }

  async registerMovement(): Promise<void> {
    const productId = this.selectedProductId();
    if (!productId || !this.form.quantity) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await this.inventoryService.registerMovement({
        productId,
        type: this.form.type,
        quantity: this.form.quantity,
        reason: this.form.reason || undefined,
      });
      this.form = { type: 'in', quantity: null, reason: '' };
      await Promise.all([this.loadProducts(), this.onProductChange(productId)]);
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ??
        'No se pudo registrar el movimiento';
      this.errorMessage.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.saving.set(false);
    }
  }
}
