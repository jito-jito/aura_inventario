import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
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
  IonText,
  IonModal,
  IonRange,
  IonSpinner,
  AlertController,
} from '@ionic/angular/standalone';
import { ProjectionsService } from '../../core/projections.service';
import { ProductsService } from '../../core/products.service';
import { computeScenarioMetrics } from '../../core/projection-math';
import {
  ProjectionPeriodInput,
  ProjectionPeriodType,
  ProjectionScenario,
  SuggestedUnitsResult,
} from '../../core/models/projection.model';
import { Product } from '../../core/models/product.model';
import { ProfitChart } from './profit-chart';

interface FormState {
  name: string;
  productId: string | null;
  unitCost: number;
  unitPrice: number;
  fixedCostsPerPeriod: number;
  periodType: ProjectionPeriodType;
  periodsCount: number;
  periods: ProjectionPeriodInput[];
}

function buildPeriods(count: number, existing: ProjectionPeriodInput[] = []): ProjectionPeriodInput[] {
  return Array.from({ length: count }, (_, i) => ({
    periodIndex: i,
    estimatedUnits: existing.find((p) => p.periodIndex === i)?.estimatedUnits ?? 0,
  }));
}

function emptyForm(): FormState {
  return {
    name: '',
    productId: null,
    unitCost: 0,
    unitPrice: 0,
    fixedCostsPerPeriod: 0,
    periodType: 'monthly',
    periodsCount: 6,
    periods: buildPeriods(6),
  };
}

@Component({
  selector: 'app-projections',
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
    IonText,
    IonModal,
    IonRange,
    IonSpinner,
    ProfitChart,
  ],
  templateUrl: './projections.html',
  styleUrl: './projections.scss',
})
export class Projections implements OnInit {
  protected readonly Number = Number;

  scenarios = signal<ProjectionScenario[]>([]);
  products = signal<Product[]>([]);
  loading = signal(true);
  selected = signal<ProjectionScenario | null>(null);

  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  suggestion = signal<SuggestedUnitsResult | null>(null);
  suggestionLoading = signal(false);

  form: FormState = emptyForm();

  whatIfPrice = signal<number | null>(null);

  whatIfMetrics = computed(() => {
    const scenario = this.selected();
    if (!scenario) return null;
    const price = this.whatIfPrice() ?? Number(scenario.unitPrice);
    return computeScenarioMetrics({
      unitCost: Number(scenario.unitCost),
      unitPrice: price,
      fixedCostsPerPeriod: Number(scenario.fixedCostsPerPeriod),
      periods: scenario.periods.map((p) => ({ periodIndex: p.periodIndex, estimatedUnits: p.estimatedUnits })),
    });
  });

  profitDelta = computed(() => {
    const scenario = this.selected();
    const whatIf = this.whatIfMetrics();
    if (!scenario || !whatIf) return null;
    return whatIf.totalNetProfit - scenario.metrics.totalNetProfit;
  });

  constructor(
    private readonly projectionsService: ProjectionsService,
    private readonly productsService: ProductsService,
    private readonly alertController: AlertController,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [scenarios, products] = await Promise.all([
        this.projectionsService.findAll(),
        this.productsService.findAll(),
      ]);
      this.scenarios.set(scenarios);
      this.products.set(products);
    } finally {
      this.loading.set(false);
    }
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form = emptyForm();
    this.suggestion.set(null);
    this.errorMessage.set(null);
    this.showForm.set(true);
  }

  openEditForm(scenario: ProjectionScenario): void {
    this.editingId.set(scenario.id);
    this.form = {
      name: scenario.name,
      productId: scenario.productId,
      unitCost: Number(scenario.unitCost),
      unitPrice: Number(scenario.unitPrice),
      fixedCostsPerPeriod: Number(scenario.fixedCostsPerPeriod),
      periodType: scenario.periodType,
      periodsCount: scenario.periods.length,
      periods: buildPeriods(
        scenario.periods.length,
        scenario.periods.map((p) => ({ periodIndex: p.periodIndex, estimatedUnits: p.estimatedUnits })),
      ),
    };
    this.suggestion.set(null);
    this.errorMessage.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  onPeriodsCountChange(): void {
    const count = Math.max(1, Math.min(60, this.form.periodsCount || 1));
    this.form.periodsCount = count;
    this.form.periods = buildPeriods(count, this.form.periods);
  }

  useCostFromProduct(): void {
    const product = this.products().find((p) => p.id === this.form.productId);
    if (product) {
      this.form.unitCost = Number(product.cost);
    }
  }

  async fetchSuggestion(): Promise<void> {
    if (!this.form.productId) return;
    this.suggestionLoading.set(true);
    try {
      this.suggestion.set(
        await this.projectionsService.getSuggestedUnits(this.form.productId, this.form.periodType),
      );
    } finally {
      this.suggestionLoading.set(false);
    }
  }

  applySuggestion(): void {
    const suggestion = this.suggestion();
    if (!suggestion?.hasHistoricalData) return;
    this.applyFlatEstimate(Math.round(suggestion.averageUnitsPerPeriod));
  }

  applyFlatEstimate(units: number): void {
    this.form.periods = this.form.periods.map((p) => ({ ...p, estimatedUnits: units }));
  }

  async save(): Promise<void> {
    if (!this.form.name.trim()) return;

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const payload = {
        name: this.form.name.trim(),
        productId: this.form.productId ?? undefined,
        unitCost: this.form.unitCost,
        unitPrice: this.form.unitPrice,
        fixedCostsPerPeriod: this.form.fixedCostsPerPeriod,
        periodType: this.form.periodType,
        periods: this.form.periods,
      };

      const editingId = this.editingId();
      const saved = editingId
        ? await this.projectionsService.update(editingId, payload)
        : await this.projectionsService.create(payload);

      this.showForm.set(false);
      await this.loadAll();
      this.selected.set(saved);
      this.whatIfPrice.set(Number(saved.unitPrice));
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ?? 'No se pudo guardar el escenario';
      this.errorMessage.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.saving.set(false);
    }
  }

  async selectScenario(scenario: ProjectionScenario): Promise<void> {
    const full = await this.projectionsService.findOne(scenario.id);
    this.selected.set(full);
    this.whatIfPrice.set(Number(full.unitPrice));
  }

  async deleteScenario(scenario: ProjectionScenario): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar escenario',
      message: `¿Eliminar el escenario "${scenario.name}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.projectionsService.remove(scenario.id);
            if (this.selected()?.id === scenario.id) {
              this.selected.set(null);
            }
            await this.loadAll();
          },
        },
      ],
    });
    await alert.present();
  }

  formatCurrency(value: number | null): string {
    if (value === null) return '—';
    return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  }

  periodTypeLabel(type: ProjectionPeriodType): string {
    return type === 'weekly' ? 'semana' : 'mes';
  }
}
