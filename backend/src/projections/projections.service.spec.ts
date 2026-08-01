import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectionsService } from './projections.service';
import { ProjectionPeriodType } from './entities/projection-scenario.entity';
import { MlProcessedOrderItemStatus } from '../ml-orders/entities/ml-processed-order-item.entity';

describe('ProjectionsService', () => {
  let service: ProjectionsService;
  let scenariosRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let periodsRepository: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let productsRepository: { findOne: jest.Mock };
  let processedItemsRepository: { find: jest.Mock };

  const baseScenario = {
    id: 'scenario-1',
    name: 'Cuadro decorativo',
    productId: null,
    unitCost: '60.00',
    unitPrice: '100.00',
    fixedCostsPerPeriod: '4000.00',
    periodType: ProjectionPeriodType.MONTHLY,
    periods: [
      { periodIndex: 0, estimatedUnits: 80 },
      { periodIndex: 1, estimatedUnits: 120 },
    ],
  };

  beforeEach(() => {
    scenariosRepository = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'scenario-1', ...data })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ ...baseScenario }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    periodsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    productsRepository = { findOne: jest.fn().mockResolvedValue({ id: 'product-1' }) };
    processedItemsRepository = { find: jest.fn().mockResolvedValue([]) };

    service = new ProjectionsService(
      scenariosRepository as any,
      periodsRepository as any,
      productsRepository as any,
      processedItemsRepository as any,
    );
  });

  describe('computeMetrics', () => {
    it('calcula el margen de contribución y el punto de equilibrio en unidades', () => {
      const metrics = service.computeMetrics({
        unitCost: 60,
        unitPrice: 100,
        fixedCostsPerPeriod: 4000,
        periods: [{ periodIndex: 0, estimatedUnits: 0 }],
      });

      expect(metrics.contributionMarginPerUnit).toBe(40);
      expect(metrics.contributionMarginPercent).toBe(40);
      expect(metrics.breakEvenUnitsPerPeriod).toBe(100); // 4000 / 40
      expect(metrics.breakEvenRevenuePerPeriod).toBe(10000); // 100 * 100
    });

    it('devuelve null en el punto de equilibrio si el margen es cero o negativo', () => {
      const zeroMargin = service.computeMetrics({
        unitCost: 100,
        unitPrice: 100,
        fixedCostsPerPeriod: 4000,
        periods: [],
      });
      const negativeMargin = service.computeMetrics({
        unitCost: 120,
        unitPrice: 100,
        fixedCostsPerPeriod: 4000,
        periods: [],
      });

      expect(zeroMargin.breakEvenUnitsPerPeriod).toBeNull();
      expect(negativeMargin.breakEvenUnitsPerPeriod).toBeNull();
    });

    it('devuelve null en el porcentaje de margen si el precio es 0', () => {
      const metrics = service.computeMetrics({
        unitCost: 0,
        unitPrice: 0,
        fixedCostsPerPeriod: 0,
        periods: [],
      });
      expect(metrics.contributionMarginPercent).toBeNull();
    });

    it('calcula la ganancia neta y acumulada por período, ordenando por periodIndex', () => {
      const metrics = service.computeMetrics({
        unitCost: 60,
        unitPrice: 100,
        fixedCostsPerPeriod: 4000,
        periods: [
          { periodIndex: 1, estimatedUnits: 120 }, // fuera de orden a propósito
          { periodIndex: 0, estimatedUnits: 80 },
        ],
      });

      expect(metrics.periods.map((p) => p.periodIndex)).toEqual([0, 1]);
      // período 0: 80*100=8000 ingreso, 80*60=4800 costo var, margen 3200, neto 3200-4000=-800
      expect(metrics.periods[0]).toMatchObject({ revenue: 8000, variableCost: 4800, netProfit: -800, cumulativeNetProfit: -800 });
      // período 1: 120*100=12000 ingreso, 120*60=7200 costo var, margen 4800, neto 4800-4000=800; acumulado -800+800=0
      expect(metrics.periods[1]).toMatchObject({ revenue: 12000, variableCost: 7200, netProfit: 800, cumulativeNetProfit: 0 });
    });

    it('identifica el primer período donde la ganancia acumulada deja de ser negativa', () => {
      const metrics = service.computeMetrics({
        unitCost: 60,
        unitPrice: 100,
        fixedCostsPerPeriod: 4000,
        periods: [
          { periodIndex: 0, estimatedUnits: 80 }, // acumulado -800
          { periodIndex: 1, estimatedUnits: 120 }, // acumulado 0 -> equilibrio
          { periodIndex: 2, estimatedUnits: 50 }, // acumulado sigue positivo
        ],
      });

      expect(metrics.breakEvenPeriodIndex).toBe(1);
      expect(metrics.totalNetProfit).toBe(metrics.periods[2].cumulativeNetProfit);
    });

    it('breakEvenPeriodIndex es null si nunca se alcanza el equilibrio en los períodos dados', () => {
      const metrics = service.computeMetrics({
        unitCost: 60,
        unitPrice: 100,
        fixedCostsPerPeriod: 10000,
        periods: [
          { periodIndex: 0, estimatedUnits: 10 },
          { periodIndex: 1, estimatedUnits: 10 },
        ],
      });

      expect(metrics.breakEvenPeriodIndex).toBeNull();
    });

    it('totalFixedCosts es fixedCostsPerPeriod multiplicado por la cantidad de períodos', () => {
      const metrics = service.computeMetrics({
        unitCost: 60,
        unitPrice: 100,
        fixedCostsPerPeriod: 500,
        periods: [
          { periodIndex: 0, estimatedUnits: 10 },
          { periodIndex: 1, estimatedUnits: 10 },
          { periodIndex: 2, estimatedUnits: 10 },
        ],
      });

      expect(metrics.totalFixedCosts).toBe(1500);
    });
  });

  describe('create', () => {
    it('rechaza si el producto vinculado no existe', async () => {
      productsRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create({
          name: 'Test',
          productId: 'missing',
          unitCost: 10,
          unitPrice: 20,
          periodType: ProjectionPeriodType.MONTHLY,
          periods: [{ periodIndex: 0, estimatedUnits: 5 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza períodos con periodIndex repetido', async () => {
      await expect(
        service.create({
          name: 'Test',
          unitCost: 10,
          unitPrice: 20,
          periodType: ProjectionPeriodType.MONTHLY,
          periods: [
            { periodIndex: 0, estimatedUnits: 5 },
            { periodIndex: 0, estimatedUnits: 7 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el escenario y devuelve las métricas calculadas', async () => {
      const result = await service.create({
        name: 'Cuadro decorativo',
        unitCost: 60,
        unitPrice: 100,
        fixedCostsPerPeriod: 4000,
        periodType: ProjectionPeriodType.MONTHLY,
        periods: [{ periodIndex: 0, estimatedUnits: 80 }],
      });

      expect(scenariosRepository.save).toHaveBeenCalled();
      expect(result.metrics.contributionMarginPerUnit).toBe(40);
    });
  });

  describe('update', () => {
    it('lanza NotFoundException si el escenario no existe', async () => {
      scenariosRepository.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('reemplaza por completo los períodos cuando se envían', async () => {
      await service.update('scenario-1', {
        periods: [{ periodIndex: 0, estimatedUnits: 999 }],
      });

      expect(periodsRepository.delete).toHaveBeenCalledWith({ scenarioId: 'scenario-1' });
      expect(periodsRepository.save).toHaveBeenCalled();
    });

    it('no toca los períodos si no se envían', async () => {
      await service.update('scenario-1', { name: 'Nuevo nombre' });
      expect(periodsRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lanza NotFoundException si no existe', async () => {
      scenariosRepository.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('elimina el escenario existente', async () => {
      await service.remove('scenario-1');
      expect(scenariosRepository.remove).toHaveBeenCalled();
    });
  });

  describe('getSuggestedUnitsPerPeriod', () => {
    it('indica que no hay datos históricos si no hubo ventas procesadas', async () => {
      processedItemsRepository.find.mockResolvedValue([]);
      const result = await service.getSuggestedUnitsPerPeriod('product-1', ProjectionPeriodType.MONTHLY);
      expect(result).toEqual({
        hasHistoricalData: false,
        averageUnitsPerPeriod: 0,
        totalUnitsSold: 0,
        observedPeriods: 0,
      });
    });

    it('filtra solo ventas con status processed', async () => {
      await service.getSuggestedUnitsPerPeriod('product-1', ProjectionPeriodType.MONTHLY);
      expect(processedItemsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'product-1', status: MlProcessedOrderItemStatus.PROCESSED },
        }),
      );
    });

    it('calcula el promedio de unidades por período mensual a partir del historial', async () => {
      // 90 días de historial, 180 unidades vendidas en total -> ~3 meses -> 60 u/mes
      processedItemsRepository.find.mockResolvedValue([
        { quantity: 60, processedAt: new Date('2026-01-01T00:00:00Z') },
        { quantity: 60, processedAt: new Date('2026-02-01T00:00:00Z') },
        { quantity: 60, processedAt: new Date('2026-04-01T00:00:00Z') },
      ]);

      const result = await service.getSuggestedUnitsPerPeriod('product-1', ProjectionPeriodType.MONTHLY);

      expect(result.hasHistoricalData).toBe(true);
      expect(result.totalUnitsSold).toBe(180);
      expect(result.observedPeriods).toBe(3); // ~90 días / 30
      expect(result.averageUnitsPerPeriod).toBe(60);
    });

    it('no divide por cero cuando todas las ventas ocurrieron el mismo día', async () => {
      processedItemsRepository.find.mockResolvedValue([
        { quantity: 5, processedAt: new Date('2026-01-01T10:00:00Z') },
        { quantity: 3, processedAt: new Date('2026-01-01T12:00:00Z') },
      ]);

      const result = await service.getSuggestedUnitsPerPeriod('product-1', ProjectionPeriodType.WEEKLY);

      expect(result.observedPeriods).toBe(1);
      expect(result.averageUnitsPerPeriod).toBe(8);
    });
  });
});
