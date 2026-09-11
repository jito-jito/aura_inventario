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
  IonSelect,
  IonSelectOption,
  IonItem,
  IonLabel,
  IonInput,
  IonBadge,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronExpandOutline, chevronUpOutline } from 'ionicons/icons';
import { MlOrdersService } from '../../core/ml-orders.service';
import { MlProcessedOrderItem, MlProcessedOrderItemStatus } from '../../core/models/ml-processed-order-item.model';

type SortColumn = 'processedAt' | 'product' | 'mlOrderId' | 'quantity' | 'status';
type SortDirection = 'asc' | 'desc';

const COLUMN_COMPARATORS: Record<SortColumn, (sale: MlProcessedOrderItem) => string | number> = {
  processedAt: (sale) => sale.processedAt,
  product: (sale) => `${sale.product.name} (${sale.product.sku})`.toLowerCase(),
  mlOrderId: (sale) => sale.mlOrderId,
  quantity: (sale) => sale.quantity,
  status: (sale) => sale.status,
};

const STATUS_LABELS: Record<MlProcessedOrderItemStatus, string> = {
  processed: 'Procesada',
  error: 'Error',
};

@Component({
  selector: 'app-sales',
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
    IonSelect,
    IonSelectOption,
    IonItem,
    IonLabel,
    IonInput,
    IonBadge,
    IonIcon,
    IonSpinner,
  ],
  templateUrl: './sales.html',
  styleUrl: './sales.scss',
})
export class Sales implements OnInit {
  loading = signal(true);
  sales = signal<MlProcessedOrderItem[]>([]);

  dateFrom = signal('');
  dateTo = signal('');
  status = signal<MlProcessedOrderItemStatus | ''>('');
  searchTerm = signal('');

  columnSort = signal<{ column: SortColumn; direction: SortDirection } | null>(null);
  sortedSales = computed(() => {
    const sort = this.columnSort();
    const list = this.sales();
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

  constructor(private readonly mlOrdersService: MlOrdersService) {
    addIcons({ chevronDownOutline, chevronExpandOutline, chevronUpOutline });
  }

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.sales.set(
        await this.mlOrdersService.findProcessed({
          dateFrom: this.dateFrom() || undefined,
          dateTo: this.dateTo() || undefined,
          status: this.status() || undefined,
          search: this.searchTerm() || undefined,
        }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string | null | undefined): void {
    this.searchTerm.set(value ?? '');
    this.load();
  }

  onDateFromChange(value: string | null | undefined): void {
    this.dateFrom.set(value ?? '');
    this.load();
  }

  onDateToChange(value: string | null | undefined): void {
    this.dateTo.set(value ?? '');
    this.load();
  }

  onStatusChange(value: string | null | undefined): void {
    this.status.set(value === 'processed' || value === 'error' ? value : '');
    this.load();
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

  statusLabel(status: MlProcessedOrderItemStatus): string {
    return STATUS_LABELS[status];
  }
}
