import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role, WorkflowType } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, token) => {
  try {
    const url = new URL(req.url);
    const forecastId = url.pathname.split('/').slice(-2)[0];

    if (!forecastId) {
      return NextResponse.json({ error: 'Missing forecastId' }, { status: 400 });
    }

    const forecast = await salesIntelligenceService.approveForecast(
      forecastId,
      token.email ?? token.sub ?? 'unknown'
    );
    
    // Trigger DEMAND_TO_PLAN workflow if one doesn't already exist
    const existingWorkflow = await prisma.workflowRun.findFirst({
      where: {
        payload: {
          path: ['forecastId'],
          equals: forecastId
        }
      }
    });

    if (!existingWorkflow) {
      console.log('[FORECAST APPROVAL] No existing workflow found, creating DEMAND_TO_PLAN workflow for forecast:', forecastId);
      
      await orchestratorService.triggerWorkflow(
        WorkflowType.DEMAND_TO_PLAN,
        token.email ?? token.sub ?? 'manual-approval',
        {
          modelId: forecast.modelId,
          forecastId: forecast.id,
          horizon: forecast.horizon,
          productId: forecast.productId,
          region: forecast.region,
          source: 'manual_forecast_approval'
        }
      );
      
      console.log('[FORECAST APPROVAL] Workflow created successfully');
    } else {
      console.log('[FORECAST APPROVAL] Workflow already exists:', existingWorkflow.id);
    }
    
    return NextResponse.json(forecast);
  } catch (error) {
    const e = error as Error;
    console.error('[FORECAST APPROVAL] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.EXECUTIVE, Role.ADMIN]);
