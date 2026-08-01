export type ProjectionPeriodType = 'weekly' | 'monthly';

export interface ProjectionPeriodInput {
  periodIndex: number;
  estimatedUnits: number;
}

export interface PeriodMetric extends ProjectionPeriodInput {
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

export interface ProjectionScenario {
  id: string;
  name: string;
  productId: string | null;
  product: { id: string; sku: string; name: string } | null;
  unitCost: string;
  unitPrice: string;
  fixedCostsPerPeriod: string;
  periodType: ProjectionPeriodType;
  periods: { id: string; periodIndex: number; estimatedUnits: number }[];
  metrics: ScenarioMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectionScenarioPayload {
  name: string;
  productId?: string;
  unitCost: number;
  unitPrice: number;
  fixedCostsPerPeriod?: number;
  periodType: ProjectionPeriodType;
  periods: ProjectionPeriodInput[];
}

export type UpdateProjectionScenarioPayload = Partial<CreateProjectionScenarioPayload>;

export interface SuggestedUnitsResult {
  hasHistoricalData: boolean;
  averageUnitsPerPeriod: number;
  totalUnitsSold: number;
  observedPeriods: number;
}
