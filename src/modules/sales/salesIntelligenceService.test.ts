import { test, expect, vi, describe, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ModelType, ForecastStatus } from '@prisma/client';
import { SalesIntelligenceService } from './salesIntelligenceService';

const mPrismaClient = vi.hoisted(() => ({
  salesRecord: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  trainedModel: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  forecastResult: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  approvalGate: {
    create: vi.fn(),
  }
}));

vi.mock('@/lib/prisma', () => ({
  default: mPrismaClient
}));

vi.mock('@/modules/orchestrator/orchestratorService', () => ({
  orchestratorService: {
    requestApproval: vi.fn(),
  }
}));

// Mock TF.js node to avoid actual training in tests
vi.mock('@tensorflow/tfjs-node', () => {
  return {
    sequential: vi.fn(() => ({
      add: vi.fn(),
      compile: vi.fn(),
      fit: vi.fn().mockResolvedValue({}),
      predict: vi.fn(() => {
        // Mock prediction values to match input length if possible
        return {
          data: vi.fn().mockResolvedValue(new Float32Array(new Array(10).fill(10))), 
          dispose: vi.fn(),
        };
      }),
      save: vi.fn().mockResolvedValue({}),
      dispose: vi.fn(),
    })),
    layers: {
      dense: vi.fn(),
      lstm: vi.fn(),
    },
    tensor2d: vi.fn(() => ({
      dispose: vi.fn(),
      reshape: vi.fn(() => ({
        dispose: vi.fn(),
      })),
    })),
    loadLayersModel: vi.fn().mockResolvedValue({
      predict: vi.fn(() => ({
        data: vi.fn().mockResolvedValue(new Float32Array([100, 200])),
        dispose: vi.fn(),
      })),
      dispose: vi.fn(),
    }),
  };
});

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(JSON.stringify({ xMean: 0, xStd: 1, yMean: 0, yStd: 1, modelType: 'LINEAR_REGRESSION' })),
  }
}));

describe('SalesIntelligenceService Property Tests', () => {
  let service: SalesIntelligenceService;

  beforeEach(() => {
    service = new SalesIntelligenceService();
    vi.clearAllMocks();
  });

  test('Property 13: Trained model metrics are valid numbers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.float({ min: 1, max: 1000, noNaN: true }), { minLength: 5, maxLength: 100 }),
        async (quantities) => {
          mPrismaClient.salesRecord.findMany.mockResolvedValue(
            quantities.map(q => ({ quantity: q }))
          );
          mPrismaClient.trainedModel.create.mockImplementation(({ data }) => 
            Promise.resolve({ id: 'm1', ...data })
          );

          try {
            const model = await service.trainModel({
              type: ModelType.LINEAR_REGRESSION,
              productId: 'p1',
              region: 'r1'
            });

            // If training succeeds, metrics must be valid
            expect(typeof model.mae).toBe('number');
            expect(typeof model.rmse).toBe('number');
            expect(typeof model.r2Score).toBe('number');
            expect(isFinite(model.mae)).toBe(true);
            expect(isFinite(model.rmse)).toBe(true);
            expect(isFinite(model.r2Score)).toBe(true);
            expect(model.mae).toBeGreaterThanOrEqual(0);
            expect(model.rmse).toBeGreaterThanOrEqual(0);
          } catch (error) {
            // If training fails, it must be due to insufficient data or variance
            const e = error as Error;
            expect(e.message).toMatch(/Insufficient (data|variance)|Training failed/);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 13b: Training fails with zero variance data', async () => {
    mPrismaClient.salesRecord.findMany.mockResolvedValue([
      { quantity: 10 }, { quantity: 10 }, { quantity: 10 }, 
      { quantity: 10 }, { quantity: 10 }
    ]);

    await expect(service.trainModel({
      type: ModelType.LINEAR_REGRESSION,
      productId: 'p1',
      region: 'r1'
    })).rejects.toThrow('Insufficient variance');
  });

  test('Property 14: Leaderboard order is consistent with metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          id: fc.string(),
          mae: fc.float({ min: 0, max: 1000, noNaN: true }),
          rmse: fc.float({ min: 0, max: 1000, noNaN: true }),
          r2Score: fc.float({ min: -1, max: 1, noNaN: true }),
        }), { minLength: 1, maxLength: 20 }),
        async (models) => {
          const sortedModels = [...models].sort((a, b) => a.mae - b.mae);
          mPrismaClient.trainedModel.findMany.mockResolvedValue(sortedModels);

          const leaderboard = await service.getLeaderboard();
          
          for (let i = 0; i < leaderboard.length - 1; i++) {
            expect(leaderboard[i].mae).toBeLessThanOrEqual(leaderboard[i + 1].mae);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 15: Forecast horizon matches requested days', async () => {
    mPrismaClient.trainedModel.findUniqueOrThrow.mockResolvedValue({ 
      artifactPath: 'some/path',
      modelType: ModelType.LINEAR_REGRESSION 
    });
    mPrismaClient.forecastResult.create.mockImplementation(({ data }) => 
      Promise.resolve({ id: 'f1', ...data })
    );

    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 365 }), async (horizon) => {
        const result = await service.runForecast('m1', horizon);
        expect(result.horizon).toBe(horizon);
        expect(Array.isArray(result.predictions)).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  test('Property 16: Forecast status lifecycle is monotonic - DRAFT to PENDING_APPROVAL', async () => {
    mPrismaClient.forecastResult.findUnique.mockResolvedValue({ 
      id: 'f1', 
      status: ForecastStatus.DRAFT 
    });
    mPrismaClient.forecastResult.update.mockResolvedValue({ 
      id: 'f1', 
      status: ForecastStatus.PENDING_APPROVAL 
    });
    
    const result = await service.submitForecastForApproval('f1', 'run-1');
    expect(result.status).toBe(ForecastStatus.PENDING_APPROVAL);
  });

  test('Property 16b: Forecast status lifecycle is monotonic - PENDING_APPROVAL to APPROVED', async () => {
    mPrismaClient.forecastResult.findUnique.mockResolvedValue({ 
      id: 'f1', 
      status: ForecastStatus.PENDING_APPROVAL 
    });
    mPrismaClient.forecastResult.update.mockResolvedValue({ 
      id: 'f1', 
      status: ForecastStatus.APPROVED,
      approvedBy: 'user1',
      approvedAt: new Date(),
    });
    
    const result = await service.approveForecast('f1', 'user1');
    expect(result.status).toBe(ForecastStatus.APPROVED);
    expect(result.approvedBy).toBe('user1');
    expect(result.approvedAt).toBeDefined();
  });

  test('Property 16c: Forecast cannot regress from APPROVED to DRAFT', async () => {
    mPrismaClient.forecastResult.findUnique.mockResolvedValue({ 
      id: 'f1', 
      status: ForecastStatus.APPROVED 
    });
    
    await expect(service.submitForecastForApproval('f1', 'run-1'))
      .rejects.toThrow('not in DRAFT status');
  });

  test('Property 16d: Forecast can be rejected from PENDING_APPROVAL', async () => {
    mPrismaClient.forecastResult.findUnique.mockResolvedValue({ 
      id: 'f1', 
      status: ForecastStatus.PENDING_APPROVAL 
    });
    mPrismaClient.forecastResult.update.mockResolvedValue({ 
      id: 'f1', 
      status: ForecastStatus.REJECTED 
    });
    
    const result = await service.rejectForecast('f1');
    expect(result.status).toBe(ForecastStatus.REJECTED);
  });

  test('Actuals recording persists correct data', async () => {
    const actualData = {
      productId: 'p1',
      region: 'r1',
      date: new Date('2024-01-01'),
      quantity: 100,
      revenue: 5000,
      source: 'ACTUAL'
    };

    mPrismaClient.salesRecord.create.mockResolvedValue({ id: 'sr1', ...actualData });

    const result = await service.recordActuals(actualData);
    
    expect(mPrismaClient.salesRecord.create).toHaveBeenCalledWith({
      data: actualData
    });
    expect(result.productId).toBe('p1');
  });

  test('MLOps metrics returns complete model information', async () => {
    const mockModel = {
      id: 'm1',
      modelType: ModelType.LINEAR_REGRESSION,
      mae: 10.5,
      rmse: 15.2,
      r2Score: 0.85,
      trainedAt: new Date('2024-01-01'),
    };

    mPrismaClient.trainedModel.findUnique.mockResolvedValue(mockModel);
    mPrismaClient.forecastResult.count.mockResolvedValue(5);

    const metrics = await service.getMLOpsMetrics('m1');

    expect(metrics.modelId).toBe('m1');
    expect(metrics.modelType).toBe(ModelType.LINEAR_REGRESSION);
    expect(metrics.mae).toBe(10.5);
    expect(metrics.forecastCount).toBe(5);
  });

  test('All model types can be trained', async () => {
    const modelTypes = [
      ModelType.LINEAR_REGRESSION,
      ModelType.RANDOM_FOREST,
      ModelType.XGBOOST,
      ModelType.ARIMA
    ];

    for (const type of modelTypes) {
      mPrismaClient.salesRecord.findMany.mockResolvedValue([
        { quantity: 10 }, { quantity: 20 }, { quantity: 30 }, 
        { quantity: 40 }, { quantity: 50 }
      ]);
      mPrismaClient.trainedModel.create.mockImplementation(({ data }) => 
        Promise.resolve({ id: `m-${type}`, ...data })
      );

      const model = await service.trainModel({
        type,
        productId: 'p1',
        region: 'r1'
      });

      expect(model.modelType).toBe(type);
      expect(model.mae).toBeGreaterThanOrEqual(0);
    }
  });

  test('Property 13c: Training fails with insufficient data', async () => {
    mPrismaClient.salesRecord.findMany.mockResolvedValue([
      { quantity: 10 }, { quantity: 20 }, { quantity: 30 }
    ]);

    await expect(service.trainModel({
      type: ModelType.LINEAR_REGRESSION,
      productId: 'p1',
      region: 'r1'
    })).rejects.toThrow('Insufficient data');
  });
});
