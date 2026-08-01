import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MlProcessedOrderItem,
  MlProcessedOrderItemStatus,
} from '../ml-orders/entities/ml-processed-order-item.entity';
import { Product } from '../products/entities/product.entity';
import { CreateProjectionScenarioDto, ProjectionPeriodInputDto } from './dto/create-projection-scenario.dto';
import { UpdateProjectionScenarioDto } from './dto/update-projection-scenario.dto';
import { ProjectionPeriod } from './entities/projection-period.entity';
import { ProjectionPeriodType, ProjectionScenario } from './entities/projection-scenario.entity';

export interface PeriodMetric {
  periodIndex: number;
  estimatedUnits: number;
  revenue: number;
  variableCost: number;
  grossProfit: number;
  netProfit: number;
  cumulativeNetProfit: number;
}

export interface ScenarioMetrics {
  contributionMarginPerUnit: number;
  contributionMarginPercent: number | null;
  breakEvenUnitsPerPeriod: number | null;
  breakEvenRevenuePerPeriod: number | null;
  breakEvenPeriodIndex: number | null;
  periods: PeriodMetric[];
  totalRevenue: number;
  totalVariableCost: number;
  totalFixedCosts: number;
  totalNetProfit: number;
}

export interface SuggestedUnitsResult {
  hasHistoricalData: boolean;
  averageUnitsPerPeriod: number;
  totalUnitsSold: number;
  observedPeriods: number;
}

const PERIOD_LENGTH_DAYS: Record<ProjectionPeriodType, number> = {
  [ProjectionPeriodType.WEEKLY]: 7,
  [ProjectionPeriodType.MONTHLY]: 30,
};

@Injectable()
export class ProjectionsService {
  constructor(
    @InjectRepository(ProjectionScenario)
    private readonly scenariosRepository: Repository<ProjectionScenario>,
    @InjectRepository(ProjectionPeriod)
    private readonly periodsRepository: Repository<ProjectionPeriod>,
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
    @InjectRepository(MlProcessedOrderItem)
    private readonly processedItemsRepository: Repository<MlProcessedOrderItem>,
  ) {}

  /**
   * Cálculo puro (sin acceso a datos) de la ganancia proyectada y el punto de
   * equilibrio, tanto en unidades por período como en el tiempo (el primer
   * período en el que la ganancia acumulada deja de ser negativa).
   */
  computeMetrics(params: {
    unitCost: number;
    unitPrice: number;
    fixedCostsPerPeriod: number;
    periods: { periodIndex: number; estimatedUnits: number }[];
  }): ScenarioMetrics {
    const { unitCost, unitPrice, fixedCostsPerPeriod } = params;
    const contributionMarginPerUnit = unitPrice - unitCost;
    const contributionMarginPercent =
      unitPrice > 0 ? (contributionMarginPerUnit / unitPrice) * 100 : null;
    const breakEvenUnitsPerPeriod =
      contributionMarginPerUnit > 0 ? fixedCostsPerPeriod / contributionMarginPerUnit : null;
    const breakEvenRevenuePerPeriod =
      breakEvenUnitsPerPeriod !== null ? breakEvenUnitsPerPeriod * unitPrice : null;

    const sortedPeriods = [...params.periods].sort((a, b) => a.periodIndex - b.periodIndex);
    let cumulative = 0;
    let breakEvenPeriodIndex: number | null = null;

    const periods: PeriodMetric[] = sortedPeriods.map((p) => {
      const revenue = p.estimatedUnits * unitPrice;
      const variableCost = p.estimatedUnits * unitCost;
      const grossProfit = revenue - variableCost;
      const netProfit = grossProfit - fixedCostsPerPeriod;
      cumulative += netProfit;
      if (breakEvenPeriodIndex === null && cumulative >= 0) {
        breakEvenPeriodIndex = p.periodIndex;
      }
      return {
        periodIndex: p.periodIndex,
        estimatedUnits: p.estimatedUnits,
        revenue,
        variableCost,
        grossProfit,
        netProfit,
        cumulativeNetProfit: cumulative,
      };
    });

    const totalRevenue = periods.reduce((sum, p) => sum + p.revenue, 0);
    const totalVariableCost = periods.reduce((sum, p) => sum + p.variableCost, 0);
    const totalFixedCosts = fixedCostsPerPeriod * periods.length;
    const totalNetProfit = periods.length > 0 ? periods[periods.length - 1].cumulativeNetProfit : 0;

    return {
      contributionMarginPerUnit,
      contributionMarginPercent,
      breakEvenUnitsPerPeriod,
      breakEvenRevenuePerPeriod,
      breakEvenPeriodIndex,
      periods,
      totalRevenue,
      totalVariableCost,
      totalFixedCosts,
      totalNetProfit,
    };
  }

  private validatePeriods(periods: ProjectionPeriodInputDto[]): void {
    const indexes = periods.map((p) => p.periodIndex);
    if (new Set(indexes).size !== indexes.length) {
      throw new BadRequestException('No puede haber períodos repetidos (periodIndex duplicado)');
    }
  }

  private metricsForScenario(scenario: ProjectionScenario): ScenarioMetrics {
    return this.computeMetrics({
      unitCost: Number(scenario.unitCost),
      unitPrice: Number(scenario.unitPrice),
      fixedCostsPerPeriod: Number(scenario.fixedCostsPerPeriod),
      periods: scenario.periods.map((p) => ({
        periodIndex: p.periodIndex,
        estimatedUnits: p.estimatedUnits,
      })),
    });
  }

  private async findEntityOrThrow(id: string): Promise<ProjectionScenario> {
    const scenario = await this.scenariosRepository.findOne({
      where: { id },
      relations: { periods: true, product: true },
    });
    if (!scenario) {
      throw new NotFoundException('Escenario de proyección no encontrado');
    }
    return scenario;
  }

  async create(dto: CreateProjectionScenarioDto): Promise<ProjectionScenario & { metrics: ScenarioMetrics }> {
    if (dto.productId) {
      const product = await this.productsRepository.findOne({ where: { id: dto.productId } });
      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }
    }
    this.validatePeriods(dto.periods);

    const scenario = this.scenariosRepository.create({
      name: dto.name,
      productId: dto.productId ?? null,
      unitCost: dto.unitCost.toFixed(2),
      unitPrice: dto.unitPrice.toFixed(2),
      fixedCostsPerPeriod: (dto.fixedCostsPerPeriod ?? 0).toFixed(2),
      periodType: dto.periodType,
      periods: dto.periods.map((p) =>
        this.periodsRepository.create({ periodIndex: p.periodIndex, estimatedUnits: p.estimatedUnits }),
      ),
    });

    const saved = await this.scenariosRepository.save(scenario);
    return this.findOne(saved.id);
  }

  async findAll(): Promise<(ProjectionScenario & { metrics: ScenarioMetrics })[]> {
    const scenarios = await this.scenariosRepository.find({
      relations: { periods: true, product: true },
      order: { createdAt: 'DESC' },
    });
    return scenarios.map((scenario) => ({ ...scenario, metrics: this.metricsForScenario(scenario) }));
  }

  async findOne(id: string): Promise<ProjectionScenario & { metrics: ScenarioMetrics }> {
    const scenario = await this.findEntityOrThrow(id);
    return { ...scenario, metrics: this.metricsForScenario(scenario) };
  }

  async update(
    id: string,
    dto: UpdateProjectionScenarioDto,
  ): Promise<ProjectionScenario & { metrics: ScenarioMetrics }> {
    const scenario = await this.findEntityOrThrow(id);

    if (dto.productId !== undefined) {
      if (dto.productId) {
        const product = await this.productsRepository.findOne({ where: { id: dto.productId } });
        if (!product) {
          throw new NotFoundException('Producto no encontrado');
        }
      }
      scenario.productId = dto.productId ?? null;
    }
    if (dto.name !== undefined) scenario.name = dto.name;
    if (dto.unitCost !== undefined) scenario.unitCost = dto.unitCost.toFixed(2);
    if (dto.unitPrice !== undefined) scenario.unitPrice = dto.unitPrice.toFixed(2);
    if (dto.fixedCostsPerPeriod !== undefined) {
      scenario.fixedCostsPerPeriod = dto.fixedCostsPerPeriod.toFixed(2);
    }
    if (dto.periodType !== undefined) scenario.periodType = dto.periodType;

    await this.scenariosRepository.save(scenario);

    if (dto.periods !== undefined) {
      this.validatePeriods(dto.periods);
      await this.periodsRepository.delete({ scenarioId: id });
      const newPeriods = dto.periods.map((p) =>
        this.periodsRepository.create({ scenarioId: id, periodIndex: p.periodIndex, estimatedUnits: p.estimatedUnits }),
      );
      await this.periodsRepository.save(newPeriods);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const scenario = await this.findEntityOrThrow(id);
    await this.scenariosRepository.remove(scenario);
  }

  /**
   * Sugerencia (no vinculante) de unidades por período basada en el historial
   * real de ventas del producto, para usar como punto de partida editable.
   */
  async getSuggestedUnitsPerPeriod(
    productId: string,
    periodType: ProjectionPeriodType,
  ): Promise<SuggestedUnitsResult> {
    const rows = await this.processedItemsRepository.find({
      where: { productId, status: MlProcessedOrderItemStatus.PROCESSED },
      order: { processedAt: 'ASC' },
    });

    if (rows.length === 0) {
      return { hasHistoricalData: false, averageUnitsPerPeriod: 0, totalUnitsSold: 0, observedPeriods: 0 };
    }

    const totalUnitsSold = rows.reduce((sum, row) => sum + row.quantity, 0);
    const firstDate = rows[0].processedAt.getTime();
    const lastDate = rows[rows.length - 1].processedAt.getTime();
    const daySpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
    const observedPeriods = Math.max(1, Math.round(daySpan / PERIOD_LENGTH_DAYS[periodType]));
    const averageUnitsPerPeriod = Math.round((totalUnitsSold / observedPeriods) * 100) / 100;

    return { hasHistoricalData: true, averageUnitsPerPeriod, totalUnitsSold, observedPeriods };
  }
}
