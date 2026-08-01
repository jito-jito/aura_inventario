import { ProjectionPeriodInput, ScenarioMetrics } from './models/projection.model';

/**
 * Misma fórmula que ProjectionsService.computeMetrics en el backend. Se
 * duplica acá (deliberadamente simple, solo aritmética) para que el
 * simulador de "qué pasa si cambio el precio" responda al instante sin ir
 * al servidor.
 */
export function computeScenarioMetrics(params: {
  unitCost: number;
  unitPrice: number;
  fixedCostsPerPeriod: number;
  periods: ProjectionPeriodInput[];
}): ScenarioMetrics {
  const { unitCost, unitPrice, fixedCostsPerPeriod } = params;
  const contributionMarginPerUnit = unitPrice - unitCost;
  const contributionMarginPercent = unitPrice > 0 ? (contributionMarginPerUnit / unitPrice) * 100 : null;
  const breakEvenUnitsPerPeriod =
    contributionMarginPerUnit > 0 ? fixedCostsPerPeriod / contributionMarginPerUnit : null;
  const breakEvenRevenuePerPeriod =
    breakEvenUnitsPerPeriod !== null ? breakEvenUnitsPerPeriod * unitPrice : null;

  const sortedPeriods = [...params.periods].sort((a, b) => a.periodIndex - b.periodIndex);
  let cumulative = 0;
  let breakEvenPeriodIndex: number | null = null;

  const periods = sortedPeriods.map((p) => {
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
