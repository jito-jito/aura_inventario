import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonSearchbar,
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, createOutline } from 'ionicons/icons';
import { ProductsService } from '../../core/products.service';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-products',
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonSearchbar,
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
  ],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products implements OnInit {
  products = signal<Product[]>([]);
  searchTerm = signal('');
  showForm = signal(false);
  editingProduct = signal<Product | null>(null);
  errorMessage = signal<string | null>(null);
  saving = signal(false);

  form = { sku: '', name: '', description: '', cost: 0, stock: 0, minStock: 5 };

  constructor(private readonly productsService: ProductsService) {
    addIcons({ addOutline, createOutline });
  }

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.products.set(await this.productsService.findAll({ search: this.searchTerm() }));
  }

  onSearchChange(value: string | null | undefined): void {
    this.searchTerm.set(value ?? '');
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
}
