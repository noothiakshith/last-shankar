import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const forecastId = url.pathname.split('/').slice(-2)[0]; // /api/sales/forecast/[id]/submit
    const body = await req.json();
    const { workflowRunId } = body;

    if (!forecastId || !workflowRunId) {
      return NextResponse.json({ error: 'Missing forecastId or workflowRunId' }, { status: 400 });
    }

    const forecast = await salesIntelligenceService.submitForecastForApproval(forecastId, workflowRunId);
    return NextResponse.json(forecast);
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.ADMIN]);
