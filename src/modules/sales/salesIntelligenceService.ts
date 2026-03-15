import prisma from '@/lib/prisma';
import { ModelType, ForecastStatus, TrainedModel, ForecastResult, Role, ApprovalGateType, ApprovalStatus } from '@prisma/client';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';

export interface ModelConfig {
  type: ModelType;
  productId: string;
  region: string;
}

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8008';

export class SalesIntelligenceService {
  async trainModel(config: ModelConfig): Promise<TrainedModel> {
    const salesData = await prisma.salesRecord.findMany({
      where: {
        productId: config.productId,
        region: config.region,
      },
      orderBy: { date: 'asc' },
    });

    if (salesData.length < 5) {
      throw new Error(`Insufficient data for training: found ${salesData.length} records, need at least 5.`);
    }

    const response = await fetch(`${PYTHON_SERVICE_URL}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: config.productId,
        region: config.region,
        modelType: config.type,
        data: salesData.map(d => ({ quantity: d.quantity, date: d.date.toISOString() }))
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (err.detail === 'Insufficient variance in data') {
        throw new Error(`Insufficient variance in data`);
      }
      throw new Error(`Python ML Service training failed: ${err.detail || response.statusText}`);
    }

    const result = await response.json();

    const trainedModel = await prisma.trainedModel.create({
      data: {
        productId: config.productId,
        region: config.region,
        modelType: config.type,
        mae: result.mae,
        rmse: result.rmse,
        r2Score: result.r2Score,
        artifactPath: result.artifactPath,
        isActive: true,
      }
    });

    return trainedModel;
  }

  async getLeaderboard(): Promise<TrainedModel[]> {
    return prisma.trainedModel.findMany({
      orderBy: { mae: 'asc' },
    });
  }

  async getPendingForecasts(): Promise<ForecastResult[]> {
    return prisma.forecastResult.findMany({
      where: { status: ForecastStatus.PENDING_APPROVAL },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async runForecast(modelId: string, horizon: number): Promise<ForecastResult> {
    const modelRecord = await prisma.trainedModel.findUniqueOrThrow({ where: { id: modelId } });
    
    const response = await fetch(`${PYTHON_SERVICE_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelPath: modelRecord.artifactPath,
        horizon
      })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Python ML Service forecast failed: ${err.detail || response.statusText}`);
    }

    const result = await response.json();

    const forecast = await prisma.forecastResult.create({
      data: {
        modelId,
        productId: modelRecord.productId,
        region: modelRecord.region,
        horizon,
        predictions: result.predictions,
        status: ForecastStatus.DRAFT,
      }
    });

    return forecast;
  }

  async submitForecastForApproval(forecastId: string, workflowRunId: string): Promise<ForecastResult> {
    // Verify forecast exists and is in DRAFT status
    const existingForecast = await prisma.forecastResult.findUnique({
      where: { id: forecastId }
    });

    if (!existingForecast) {
      throw new Error(`Forecast ${forecastId} not found`);
    }

    if (existingForecast.status !== ForecastStatus.DRAFT) {
      throw new Error(`Forecast ${forecastId} is not in DRAFT status. Current status: ${existingForecast.status}`);
    }

    const forecast = await prisma.forecastResult.update({
      where: { id: forecastId },
      data: { status: ForecastStatus.PENDING_APPROVAL }
    });

    await orchestratorService.requestApproval(
      workflowRunId,
      ApprovalGateType.FORECAST_APPROVAL,
      Role.SALES_ANALYST
    );

    return forecast;
  }

  async approveForecast(forecastId: string, approvedBy: string): Promise<ForecastResult> {
    const forecast = await prisma.forecastResult.findUnique({
      where: { id: forecastId }
    });

    if (!forecast) {
      throw new Error(`Forecast ${forecastId} not found`);
    }

    if (forecast.status !== ForecastStatus.PENDING_APPROVAL) {
      throw new Error(`Forecast ${forecastId} is not pending approval. Current status: ${forecast.status}`);
    }

    const updatedForecast = await prisma.forecastResult.update({
      where: { id: forecastId },
      data: {
        status: ForecastStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      }
    });

    // Resolve orchestrator gate
    if (orchestratorService.resolveApprovalByPayload) {
      await orchestratorService.resolveApprovalByPayload(
        ApprovalGateType.FORECAST_APPROVAL,
        'forecastId',
        forecastId,
        Role.SALES_ANALYST,
        approvedBy,
        true
      );
    }

    return updatedForecast;
  }

  async rejectForecast(forecastId: string, rejectedBy: string): Promise<ForecastResult> {
    const forecast = await prisma.forecastResult.findUnique({
      where: { id: forecastId }
    });

    if (!forecast) {
      throw new Error(`Forecast ${forecastId} not found`);
    }

    const updatedForecast = await prisma.forecastResult.update({
      where: { id: forecastId },
      data: {
        status: ForecastStatus.REJECTED
      }
    });

    // Resolve orchestrator gate
    if (orchestratorService.resolveApprovalByPayload) {
      await orchestratorService.resolveApprovalByPayload(
        ApprovalGateType.FORECAST_APPROVAL,
        'forecastId',
        forecastId,
        Role.SALES_ANALYST,
        rejectedBy,
        false
      );
    }

    return updatedForecast;
  }

  async getMLOpsMetrics(modelId: string): Promise<{
    modelId: string;
    modelType: ModelType;
    mae: number;
    rmse: number;
    r2Score: number;
    trainedAt: Date;
    forecastCount: number;
  }> {
    const model = await prisma.trainedModel.findUnique({
      where: { id: modelId }
    });

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const forecastCount = await prisma.forecastResult.count({
      where: { modelId }
    });

    return {
      modelId: model.id,
      modelType: model.modelType,
      mae: model.mae,
      rmse: model.rmse,
      r2Score: model.r2Score,
      trainedAt: model.trainedAt,
      forecastCount,
    };
  }

  async recordActuals(data: { productId: string; region: string; date: Date; quantity: number; revenue: number; source: string }) {
    return prisma.salesRecord.create({
      data: {
        productId: data.productId,
        region: data.region,
        date: data.date,
        quantity: data.quantity,
        revenue: data.revenue,
        source: data.source,
      }
    });
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = await prisma.trainedModel.findUnique({
      where: { id: modelId }
    });

    if (model) {
      // Try to delete from Python service first
      try {
        await fetch(`${PYTHON_SERVICE_URL}/models?path=${encodeURIComponent(model.artifactPath)}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn('Failed to delete model artifact from Python service:', err);
      }

      await prisma.trainedModel.delete({
        where: { id: modelId }
      });
    }
  }
}

export const salesIntelligenceService = new SalesIntelligenceService();
