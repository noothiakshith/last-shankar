import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import { ModelType, ForecastStatus, WorkflowType } from '@prisma/client';
import { salesIntelligenceService } from './salesIntelligenceService';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';
import prisma from '@/lib/prisma';

describe('Sales Intelligence Integration Tests', () => {
  let testProductId: string;
  let testRegion: string;

  beforeAll(async () => {
    // Setup test data
    testProductId = 'TEST_PRODUCT_001';
    testRegion = 'TEST_REGION';

    // Create sample sales records with sufficient variance
    const baseDate = new Date('2024-01-01');
    for (let i = 0; i < 30; i++) {
      await prisma.salesRecord.create({
        data: {
          date: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000),
          productId: testProductId,
          region: testRegion,
          quantity: 100 + Math.random() * 50, // 100-150 range
          revenue: 1000 + Math.random() * 500,
          source: 'TEST',
        },
      });
    }
  });

  afterAll(async () => {
    // Cleanup
    await prisma.salesRecord.deleteMany({
      where: { productId: testProductId },
    });
    await prisma.trainedModel.deleteMany({
      where: { modelType: ModelType.LINEAR_REGRESSION },
    });
    await prisma.forecastResult.deleteMany();
  });

  test('End-to-end: Train model, generate forecast, submit for approval', async () => {
    // Step 1: Train a model
    const model = await salesIntelligenceService.trainModel({
      type: ModelType.LINEAR_REGRESSION,
      productId: testProductId,
      region: testRegion,
    });

    expect(model.id).toBeDefined();
    expect(model.modelType).toBe(ModelType.LINEAR_REGRESSION);
    expect(model.mae).toBeGreaterThanOrEqual(0);
    expect(model.rmse).toBeGreaterThanOrEqual(0);
    expect(isFinite(model.r2Score)).toBe(true);

    // Step 2: Check leaderboard
    const leaderboard = await salesIntelligenceService.getLeaderboard();
    expect(leaderboard.length).toBeGreaterThan(0);
    const foundModel = leaderboard.find(m => m.id === model.id);
    expect(foundModel).toBeDefined();

    // Step 3: Generate forecast
    const forecast = await salesIntelligenceService.runForecast(model.id, 7);
    expect(forecast.id).toBeDefined();
    expect(forecast.modelId).toBe(model.id);
    expect(forecast.horizon).toBe(7);
    expect(forecast.status).toBe(ForecastStatus.DRAFT);
    expect(Array.isArray(forecast.predictions)).toBe(true);

    // Step 4: Create a workflow run for approval
    const workflowRun = await orchestratorService.triggerWorkflow(
      WorkflowType.DEMAND_TO_PLAN,
      'test-user',
      { forecastId: forecast.id }
    );

    // Step 5: Submit forecast for approval
    const submittedForecast = await salesIntelligenceService.submitForecastForApproval(
      forecast.id,
      workflowRun.id
    );
    expect(submittedForecast.status).toBe(ForecastStatus.PENDING_APPROVAL);

    // Step 6: Approve forecast
    const approvedForecast = await salesIntelligenceService.approveForecast(
      forecast.id,
      'approver@test.com'
    );
    expect(approvedForecast.status).toBe(ForecastStatus.APPROVED);
    expect(approvedForecast.approvedBy).toBe('approver@test.com');
    expect(approvedForecast.approvedAt).toBeDefined();

    // Step 7: Get MLOps metrics
    const mlopsMetrics = await salesIntelligenceService.getMLOpsMetrics(model.id);
    expect(mlopsMetrics.modelId).toBe(model.id);
    expect(mlopsMetrics.forecastCount).toBeGreaterThanOrEqual(1);
  });

  test('Forecast lifecycle: Cannot approve DRAFT forecast', async () => {
    const model = await salesIntelligenceService.trainModel({
      type: ModelType.LINEAR_REGRESSION,
      productId: testProductId,
      region: testRegion,
    });

    const forecast = await salesIntelligenceService.runForecast(model.id, 5);

    await expect(
      salesIntelligenceService.approveForecast(forecast.id, 'approver@test.com')
    ).rejects.toThrow('not pending approval');
  });

  test('Forecast lifecycle: Cannot submit APPROVED forecast again', async () => {
    const model = await salesIntelligenceService.trainModel({
      type: ModelType.LINEAR_REGRESSION,
      productId: testProductId,
      region: testRegion,
    });

    const forecast = await salesIntelligenceService.runForecast(model.id, 5);
    
    const workflowRun = await orchestratorService.triggerWorkflow(
      WorkflowType.DEMAND_TO_PLAN,
      'test-user',
      { forecastId: forecast.id }
    );

    await salesIntelligenceService.submitForecastForApproval(forecast.id, workflowRun.id);
    await salesIntelligenceService.approveForecast(forecast.id, 'approver@test.com');

    const workflowRun2 = await orchestratorService.triggerWorkflow(
      WorkflowType.DEMAND_TO_PLAN,
      'test-user',
      { forecastId: forecast.id }
    );

    await expect(
      salesIntelligenceService.submitForecastForApproval(forecast.id, workflowRun2.id)
    ).rejects.toThrow('not in DRAFT status');
  });

  test('Forecast can be rejected', async () => {
    const model = await salesIntelligenceService.trainModel({
      type: ModelType.LINEAR_REGRESSION,
      productId: testProductId,
      region: testRegion,
    });

    const forecast = await salesIntelligenceService.runForecast(model.id, 5);
    
    const workflowRun = await orchestratorService.triggerWorkflow(
      WorkflowType.DEMAND_TO_PLAN,
      'test-user',
      { forecastId: forecast.id }
    );

    await salesIntelligenceService.submitForecastForApproval(forecast.id, workflowRun.id);
    
    const rejectedForecast = await salesIntelligenceService.rejectForecast(forecast.id);
    expect(rejectedForecast.status).toBe(ForecastStatus.REJECTED);
  });

  test('Record actuals for MLOps feedback loop', async () => {
    const actual = await salesIntelligenceService.recordActuals({
      productId: testProductId,
      region: testRegion,
      date: new Date('2024-12-01'),
      quantity: 125,
      revenue: 1250,
      source: 'ACTUAL',
    });

    expect(actual.id).toBeDefined();
    expect(actual.productId).toBe(testProductId);
    expect(actual.quantity).toBe(125);
  });

  test('Leaderboard is sorted by MAE ascending', async () => {
    // Train multiple models
    for (let i = 0; i < 3; i++) {
      await salesIntelligenceService.trainModel({
        type: ModelType.LINEAR_REGRESSION,
        productId: testProductId,
        region: testRegion,
      });
    }

    const leaderboard = await salesIntelligenceService.getLeaderboard();
    
    for (let i = 0; i < leaderboard.length - 1; i++) {
      expect(leaderboard[i].mae).toBeLessThanOrEqual(leaderboard[i + 1].mae);
    }
  });

  test('Training fails with insufficient data', async () => {
    await expect(
      salesIntelligenceService.trainModel({
        type: ModelType.LINEAR_REGRESSION,
        productId: 'NONEXISTENT_PRODUCT',
        region: 'NONEXISTENT_REGION',
      })
    ).rejects.toThrow('Insufficient data');
  });
});
