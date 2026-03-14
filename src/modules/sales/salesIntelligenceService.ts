import prisma from '@/lib/prisma';
import * as tf from '@tensorflow/tfjs-node';
import { ModelType, ForecastStatus, TrainedModel, ForecastResult, Role, ApprovalGateType } from '@prisma/client';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';
import fs from 'fs';
import path from 'path';

export interface ModelConfig {
  type: ModelType;
  productId: string;
  region: string;
}

export class SalesIntelligenceService {
  private readonly artifactDir = path.join(process.cwd(), 'artifacts', 'models');

  constructor() {
    if (!fs.existsSync(this.artifactDir)) {
      fs.mkdirSync(this.artifactDir, { recursive: true });
    }
  }

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

    // Data preprocessing (normalization)
    const xValues = salesData.map((_, i) => i);
    const yValues = salesData.map(d => d.quantity);

    const xMean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
    const xStd = Math.sqrt(xValues.reduce((a, b) => a + Math.pow(b - xMean, 2), 0) / xValues.length) || 1;
    const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    const yStd = Math.sqrt(yValues.reduce((a, b) => a + Math.pow(b - yMean, 2), 0) / yValues.length);

    // Check for zero variance in target variable
    if (yStd < 1.0) {
      throw new Error(`Insufficient variance in data: quantity standard deviation is ${yStd.toFixed(3)}, need at least 1.0 for reliable training.`);
    }

    const xNormalized = xValues.map(v => (v - xMean) / xStd);
    const yNormalized = yValues.map(v => (v - yMean) / yStd);

    const xs = tf.tensor2d(xNormalized, [xNormalized.length, 1]);
    const ys = tf.tensor2d(yNormalized, [yNormalized.length, 1]);

    const model = tf.sequential();

    if (config.type === ModelType.LINEAR_REGRESSION) {
      model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
    } else if (config.type === ModelType.RANDOM_FOREST || config.type === ModelType.XGBOOST) {
      // Use a Deep Neural Network as a proxy for complex ensemble models in TF.js
      model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [1] }));
      model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 1 }));
    } else if (config.type === ModelType.ARIMA) {
      // Use an LSTM proxy for time series
      // Note: This requires reshaping xs to [batch, timesteps, features]
      // Reshaping for simple 1D time series forecasting
      const xsReshaped = xs.reshape([xNormalized.length, 1, 1]);
      model.add(tf.layers.lstm({ units: 32, inputShape: [1, 1] }));
      model.add(tf.layers.dense({ units: 1 }));
      
      model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
      await model.fit(xsReshaped, ys, { epochs: 100, verbose: 0 });
      xsReshaped.dispose();
    }

    if (config.type !== ModelType.ARIMA) {
      model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
      await model.fit(xs, ys, { epochs: 100, verbose: 0 });
    }

    const normalizedPredictions = model.predict(xs) as tf.Tensor;
    const normalizedPredictionValues = await normalizedPredictions.data();
    const predictionValues = Array.from(normalizedPredictionValues).map(v => v * yStd + yMean);

    // Compute metrics
    let mse = 0;
    let mae = 0;
    let totalVariation = 0;
    let residualSumOfSquares = 0;
    const meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;

    for (let i = 0; i < yValues.length; i++) {
      const actual = yValues[i];
      const predicted = predictionValues[i];
      mse += Math.pow(actual - predicted, 2);
      mae += Math.abs(actual - predicted);
      residualSumOfSquares += Math.pow(actual - predicted, 2);
      totalVariation += Math.pow(actual - meanY, 2);
    }

    mse /= yValues.length;
    mae /= yValues.length;
    const rmse = Math.sqrt(mse);
    
    // Handle edge case where all actual values are the same
    let r2Score = 0;
    if (totalVariation > 0.001) {
      r2Score = 1 - (residualSumOfSquares / totalVariation);
    }

    if (isNaN(mae) || isNaN(rmse) || !isFinite(mae) || !isFinite(rmse)) {
      throw new Error("Training failed: computed metrics are NaN or infinite.");
    }

    const modelId = `model-${Date.now()}`;
    const modelDir = path.join(this.artifactDir, modelId);
    if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
    
    const artifactPath = path.join(modelDir, 'model.json');
    await model.save(`file://${modelDir}`);

    // Save normalization metadata
    const metadata = { xMean, xStd, yMean, yStd, modelType: config.type };
    fs.writeFileSync(path.join(modelDir, 'metadata.json'), JSON.stringify(metadata));

    const trainedModel = await prisma.trainedModel.create({
      data: {
        modelType: config.type,
        mae,
        rmse,
        r2Score,
        artifactPath: modelDir, // Store directory path
        isActive: true,
      }
    });

    // Cleanup TF tensors
    xs.dispose();
    ys.dispose();
    normalizedPredictions.dispose();

    return trainedModel;
  }

  async getLeaderboard(): Promise<TrainedModel[]> {
    return prisma.trainedModel.findMany({
      orderBy: { mae: 'asc' },
    });
  }

  async runForecast(modelId: string, horizon: number): Promise<ForecastResult> {
    const modelRecord = await prisma.trainedModel.findUniqueOrThrow({ where: { id: modelId } });
    const modelDir = modelRecord.artifactPath;
    const model = await tf.loadLayersModel(`file://${modelDir}/model.json`);
    
    // Load metadata
    const metadata = JSON.parse(fs.readFileSync(path.join(modelDir, 'metadata.json'), 'utf-8'));
    const { xMean, xStd, yMean, yStd } = metadata;

    const lastTimeIndex = 100; // Simplified for demo
    const futureX = Array.from({ length: horizon }, (_, i) => lastTimeIndex + i + 1);
    const xNormalized = futureX.map(v => (v - xMean) / xStd);
    const xs = tf.tensor2d(xNormalized, [xNormalized.length, 1]);
    
    let predictions: tf.Tensor;
    if (metadata.modelType === ModelType.ARIMA) {
      const xsReshaped = xs.reshape([xNormalized.length, 1, 1]);
      predictions = model.predict(xsReshaped) as tf.Tensor;
      xsReshaped.dispose();
    } else {
      predictions = model.predict(xs) as tf.Tensor;
    }

    const normalizedValues = await predictions.data();
    const predictionValues = Array.from(normalizedValues).map(v => v * yStd + yMean);

    const forecast = await prisma.forecastResult.create({
      data: {
        modelId,
        horizon,
        predictions: predictionValues,
        status: ForecastStatus.DRAFT,
      }
    });

    xs.dispose();
    predictions.dispose();

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

    return prisma.forecastResult.update({
      where: { id: forecastId },
      data: {
        status: ForecastStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      }
    });
  }

  async rejectForecast(forecastId: string): Promise<ForecastResult> {
    const forecast = await prisma.forecastResult.findUnique({
      where: { id: forecastId }
    });

    if (!forecast) {
      throw new Error(`Forecast ${forecastId} not found`);
    }

    if (forecast.status !== ForecastStatus.PENDING_APPROVAL) {
      throw new Error(`Forecast ${forecastId} is not pending approval. Current status: ${forecast.status}`);
    }

    return prisma.forecastResult.update({
      where: { id: forecastId },
      data: {
        status: ForecastStatus.REJECTED,
      }
    });
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
}

export const salesIntelligenceService = new SalesIntelligenceService();
