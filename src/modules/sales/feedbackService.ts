import prisma from '@/lib/prisma';
import { WorkflowState } from '@prisma/client';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8008';

export interface PredictionEntry {
  predictionDate: Date;
  predictedQty: number;
}

export interface ActualFeedback {
  productId: string;
  region: string;
  date: Date;
  actualQty: number;
}

export interface ModelAccuracy {
  modelId: string;
  totalPredictions: number;
  predictionsWithActuals: number;
  mae: number | null;
  mape: number | null;
  rmse: number | null;
  driftDetected: boolean;
  lastEvaluatedAt: Date;
}

export class FeedbackService {
  /**
   * Record prediction logs when a forecast is generated
   */
  async recordPredictionLog(
    forecastId: string,
    modelId: string,
    productId: string,
    region: string,
    predictions: PredictionEntry[]
  ): Promise<void> {
    const predictionLogs = predictions.map(pred => ({
      forecastId,
      modelId,
      productId,
      region,
      predictionDate: pred.predictionDate,
      predictedQty: pred.predictedQty,
      actualQty: null,
      error: null,
      absError: null,
      squaredError: null,
    }));

    try {
      await prisma.predictionLog.createMany({
        data: predictionLogs
      });
      console.log(`[FEEDBACK] Recorded ${predictions.length} prediction logs for forecast ${forecastId}`);
    } catch (error: any) {
      console.warn(`[FEEDBACK] Failed to record prediction logs: ${error.message}`);
      // Don't throw - this is non-critical for forecast generation
    }
  }

  /**
   * Record actual sales data and match against predictions
   */
  async recordActualFeedback(feedback: ActualFeedback): Promise<void> {
    // Find matching prediction logs (within same day)
    const startOfDay = new Date(feedback.date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(feedback.date);
    endOfDay.setHours(23, 59, 59, 999);

    const matchingLogs = await prisma.predictionLog.findMany({
      where: {
        productId: feedback.productId,
        region: feedback.region,
        predictionDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        actualQty: null // Only update logs that don't have actuals yet
      }
    });

    if (matchingLogs.length === 0) {
      console.log(`[FEEDBACK] No matching prediction logs found for ${feedback.productId} in ${feedback.region} on ${feedback.date.toISOString()}`);
      return;
    }

    // Update each matching log with actual data
    for (const log of matchingLogs) {
      const error = feedback.actualQty - log.predictedQty;
      const absError = Math.abs(error);
      const squaredError = error * error;

      await prisma.predictionLog.update({
        where: { id: log.id },
        data: {
          actualQty: feedback.actualQty,
          error,
          absError,
          squaredError,
          actualRecordedAt: new Date()
        }
      });

      console.log(`[FEEDBACK] Updated prediction log ${log.id}: predicted=${log.predictedQty}, actual=${feedback.actualQty}, error=${error.toFixed(2)}`);

      // Check for drift after recording actuals
      await this.checkModelDrift(log.modelId);
    }
  }

  /**
   * Check if a model has drifted and trigger retraining if needed
   */
  async checkModelDrift(modelId: string): Promise<void> {
    const model = await prisma.trainedModel.findUnique({
      where: { id: modelId }
    });

    if (!model) {
      console.warn(`[FEEDBACK] Model ${modelId} not found`);
      return;
    }

    // Get all prediction logs with actuals for this model
    const logsWithActuals = await prisma.predictionLog.findMany({
      where: {
        modelId,
        actualQty: { not: null }
      },
      orderBy: { actualRecordedAt: 'desc' }
    });

    // Need at least 5 data points to evaluate
    if (logsWithActuals.length < 5) {
      console.log(`[FEEDBACK] Model ${modelId} has only ${logsWithActuals.length} actuals, need at least 5 for drift detection`);
      return;
    }

    // Extract predictions and actuals
    const predictions = logsWithActuals.map(log => log.predictedQty);
    const actuals = logsWithActuals.map(log => log.actualQty!);

    // Call Python service to evaluate
    try {
      const response = await fetch(`${PYTHON_SERVICE_URL}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions, actuals })
      });

      if (!response.ok) {
        console.error(`[FEEDBACK] Evaluation failed: ${response.statusText}`);
        return;
      }

      const evaluation = await response.json();
      console.log(`[FEEDBACK] Model ${modelId} evaluation: MAE=${evaluation.mae.toFixed(4)}, MAPE=${(evaluation.mape * 100).toFixed(1)}%, Drift=${evaluation.driftDetected}`);

      // If drift detected and MAPE exceeds threshold, trigger retraining
      if (evaluation.driftDetected && evaluation.mape > model.retrainThreshold) {
        console.log(`[FEEDBACK] 🔄 Triggering automatic retraining for model ${modelId}`);
        await this.triggerRetraining(modelId);
      }
    } catch (error) {
      console.error(`[FEEDBACK] Error evaluating model ${modelId}:`, error);
    }
  }

  /**
   * Trigger automatic model retraining
   */
  private async triggerRetraining(modelId: string): Promise<void> {
    const model = await prisma.trainedModel.findUnique({
      where: { id: modelId }
    });

    if (!model) {
      console.error(`[FEEDBACK] Cannot retrain: model ${modelId} not found`);
      return;
    }

    // Get all available sales data for this product/region
    const salesData = await prisma.salesRecord.findMany({
      where: {
        productId: model.productId,
        region: model.region
      },
      orderBy: { date: 'asc' }
    });

    if (salesData.length < 5) {
      console.error(`[FEEDBACK] Insufficient data for retraining: ${salesData.length} records`);
      return;
    }

    const newVersion = model.version + 1;

    try {
      const response = await fetch(`${PYTHON_SERVICE_URL}/retrain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: model.productId,
          region: model.region,
          modelType: model.modelType,
          data: salesData.map(d => ({ quantity: d.quantity, date: d.date.toISOString() })),
          previousModelPath: model.artifactPath,
          version: newVersion
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error(`[FEEDBACK] Retraining failed: ${err.detail || response.statusText}`);
        return;
      }

      const result = await response.json();

      // Update the model with new metrics and artifact path
      await prisma.trainedModel.update({
        where: { id: modelId },
        data: {
          mae: result.mae,
          rmse: result.rmse,
          r2Score: result.r2Score,
          artifactPath: result.artifactPath,
          version: newVersion,
          lastRetrainedAt: new Date()
        }
      });

      console.log(`[FEEDBACK] ✅ Model ${modelId} successfully retrained to v${newVersion}`);
      console.log(`[FEEDBACK] New metrics: MAE=${result.mae.toFixed(4)}, RMSE=${result.rmse.toFixed(4)}, R²=${result.r2Score.toFixed(4)}`);

      // Log retraining event in workflow system
      await prisma.workflowEvent.create({
        data: {
          workflowRunId: 'system-retrain',
          eventType: 'MODEL_RETRAINED',
          fromState: 'ACTIVE',
          toState: 'RETRAINED',
          metadata: {
            modelId,
            oldVersion: model.version,
            newVersion,
            oldMAE: model.mae,
            newMAE: result.mae,
            improvement: ((model.mae - result.mae) / model.mae * 100).toFixed(2) + '%'
          }
        }
      }).catch(() => {
        // Ignore if workflow run doesn't exist
        console.log(`[FEEDBACK] Skipped workflow event logging (no system workflow run)`);
      });

    } catch (error) {
      console.error(`[FEEDBACK] Error during retraining:`, error);
    }
  }

  /**
   * Get model accuracy metrics
   */
  async getModelAccuracy(modelId: string): Promise<ModelAccuracy> {
    const model = await prisma.trainedModel.findUnique({
      where: { id: modelId }
    });

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const totalPredictions = await prisma.predictionLog.count({
      where: { modelId }
    });

    const logsWithActuals = await prisma.predictionLog.findMany({
      where: {
        modelId,
        actualQty: { not: null }
      }
    });

    const predictionsWithActuals = logsWithActuals.length;

    let mae: number | null = null;
    let mape: number | null = null;
    let rmse: number | null = null;
    let driftDetected = false;

    if (predictionsWithActuals >= 5) {
      const predictions = logsWithActuals.map(log => log.predictedQty);
      const actuals = logsWithActuals.map(log => log.actualQty!);

      try {
        const response = await fetch(`${PYTHON_SERVICE_URL}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictions, actuals })
        });

        if (response.ok) {
          const evaluation = await response.json();
          mae = evaluation.mae;
          mape = evaluation.mape;
          rmse = evaluation.rmse;
          driftDetected = evaluation.driftDetected;
        }
      } catch (error) {
        console.error(`Error evaluating model accuracy:`, error);
      }
    }

    return {
      modelId,
      totalPredictions,
      predictionsWithActuals,
      mae,
      mape,
      rmse,
      driftDetected,
      lastEvaluatedAt: new Date()
    };
  }
}

export const feedbackService = new FeedbackService();
