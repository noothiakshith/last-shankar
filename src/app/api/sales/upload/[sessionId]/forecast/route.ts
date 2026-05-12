import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';
import { WorkflowType } from '@prisma/client';

interface ForecastResult {
  productId: string;
  modelId: string;
  forecastId: string;
  workflowId: string;
  horizon: number;
  totalPredictedDemand: number;
  dailyPredictions: number[];
  workflowState: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const horizon = body.horizon || 30;
    const autoApprove = body.autoApprove !== false; // Default to true

    // Get the upload session with trained models
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.trainedModelIds) {
      return NextResponse.json(
        { error: 'No trained models found. Run training first.' },
        { status: 400 }
      );
    }

    const trainedModelIds = session.trainedModelIds as Record<string, string>;
    const results: ForecastResult[] = [];
    const forecastIds: string[] = [];

    // Process each trained model
    for (const [productId, modelId] of Object.entries(trainedModelIds)) {
      const startTime = Date.now();

      try {
        // Step 1: Generate forecast
        const forecast = await salesIntelligenceService.runForecast(modelId, horizon);
        
        const predictions = forecast.predictions as number[];
        const totalDemand = predictions.reduce((sum, qty) => sum + qty, 0);

        // Step 2: Auto-approve if requested (for demo flow)
        if (autoApprove) {
          // Update status to PENDING_APPROVAL first
          const updatedForecast = await prisma.forecastResult.update({
            where: { id: forecast.id },
            data: { status: 'PENDING_APPROVAL' }
          });
          
          // Verify the update succeeded before approving
          if (updatedForecast.status === 'PENDING_APPROVAL') {
            await salesIntelligenceService.approveForecast(forecast.id, 'csv-upload-wizard');
          }
        }

        // Step 3: Trigger DEMAND_TO_PLAN workflow
        const workflowRun = await orchestratorService.triggerWorkflow(
          WorkflowType.DEMAND_TO_PLAN,
          'csv-upload-wizard',
          {
            modelId,
            forecastId: forecast.id,
            horizon,
            productId,
            region: forecast.region,
            autoApproved: autoApprove,
          }
        );

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

        results.push({
          productId,
          modelId,
          forecastId: forecast.id,
          workflowId: workflowRun.id,
          horizon,
          totalPredictedDemand: Math.round(totalDemand),
          dailyPredictions: predictions,
          workflowState: workflowRun.state,
          status: 'SUCCESS',
        });

        forecastIds.push(forecast.id);

        console.log(`[FORECAST] ${productId}: ${Math.round(totalDemand)} units over ${horizon} days (${processingTime}s)`);
      } catch (error) {
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        results.push({
          productId,
          modelId,
          forecastId: '',
          workflowId: '',
          horizon,
          totalPredictedDemand: 0,
          dailyPredictions: [],
          workflowState: 'FAILED',
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`[FORECAST] ${productId} failed:`, error);
      }
    }

    // Calculate summary
    const triggered = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;

    const workflowsSummary = {
      total: results.length,
      triggered,
      failed,
    };

    // Update session status to COMPLETED
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        forecastResults: forecastIds,
      },
    });

    return NextResponse.json({
      sessionId,
      status: 'COMPLETED',
      forecasts: results,
      workflowsSummary,
      pipelineNote: 'Each forecast has triggered a DEMAND_TO_PLAN workflow. Monitor progress on the Orchestrator dashboard.',
    });
  } catch (error) {
    console.error('Forecast generation error:', error);
    
    // Update session status to failed
    try {
      const { sessionId } = await params;
      await prisma.uploadSession.update({
        where: { id: sessionId },
        data: { status: 'FAILED' },
      });
    } catch (e) {
      console.error('Failed to update session status:', e);
    }

    return NextResponse.json(
      {
        error: 'Failed to generate forecasts',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
