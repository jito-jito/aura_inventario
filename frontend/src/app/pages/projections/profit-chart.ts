import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, Input, signal } from '@angular/core';
import { PeriodMetric, ProjectionPeriodType } from '../../core/models/projection.model';

interface ChartPoint {
  x: number;
  y: number;
  period: PeriodMetric;
}

const WIDTH = 640;
const HEIGHT = 260;
const PADDING = { top: 32, right: 16, bottom: 28, left: 56 };

@Component({
  selector: 'app-profit-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profit-chart.html',
  styleUrl: './profit-chart.scss',
})
export class ProfitChart {
  @Input({ required: true }) periods: PeriodMetric[] = [];
  @Input() periodType: ProjectionPeriodType = 'monthly';
  @Input() breakEvenPeriodIndex: number | null = null;

  readonly width = WIDTH;
  readonly height = HEIGHT;
  hoveredIndex = signal<number | null>(null);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  private get innerWidth(): number {
    return this.width - PADDING.left - PADDING.right;
  }

  private get innerHeight(): number {
    return this.height - PADDING.top - PADDING.bottom;
  }

  readonly domain = computed(() => {
    const values = this.periods.map((p) => p.cumulativeNetProfit);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    // Evita un dominio de altura 0 si todo es exactamente cero.
    const padded = max === min ? { min: min - 1, max: max + 1 } : { min, max };
    return padded;
  });

  private scaleX(index: number): number {
    const count = this.periods.length;
    if (count <= 1) return PADDING.left + this.innerWidth / 2;
    return PADDING.left + (index / (count - 1)) * this.innerWidth;
  }

  private scaleY(value: number): number {
    const { min, max } = this.domain();
    const ratio = (value - min) / (max - min || 1);
    return PADDING.top + this.innerHeight - ratio * this.innerHeight;
  }

  readonly zeroY = computed(() => this.scaleY(0));

  readonly points = computed<ChartPoint[]>(() =>
    this.periods.map((period, i) => ({
      x: this.scaleX(i),
      y: this.scaleY(period.cumulativeNetProfit),
      period,
    })),
  );

  readonly linePath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  });

  readonly yTicks = computed(() => {
    const { min, max } = this.domain();
    const steps = 4;
    const ticks: { value: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const value = min + ((max - min) * i) / steps;
      ticks.push({ value, y: this.scaleY(value) });
    }
    return ticks;
  });

  readonly hoveredPoint = computed(() => {
    const index = this.hoveredIndex();
    if (index === null) return null;
    return this.points()[index] ?? null;
  });

  readonly breakEvenPoint = computed(() => {
    if (this.breakEvenPeriodIndex === null) return null;
    return this.points().find((p) => p.period.periodIndex === this.breakEvenPeriodIndex) ?? null;
  });

  periodLabel(index: number): string {
    const unit = this.periodType === 'weekly' ? 'Semana' : 'Mes';
    return `${unit} ${index + 1}`;
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    const svg = this.host.nativeElement.querySelector('svg');
    if (!svg || this.points().length === 0) return;
    const rect = svg.getBoundingClientRect();
    const scaleFactor = this.width / rect.width;
    const localX = (event.clientX - rect.left) * scaleFactor;

    let nearestIndex = 0;
    let nearestDistance = Infinity;
    this.points().forEach((point, i) => {
      const distance = Math.abs(point.x - localX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    });
    this.hoveredIndex.set(nearestIndex);
  }

  @HostListener('pointerleave')
  onPointerLeave(): void {
    this.hoveredIndex.set(null);
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  }
}
