import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/sales/forecast - Generate a new forecast
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { modelId, horizon } = body;

    if (!modelId || !horizon) {
      return NextResponse.json(
        { error: 'Missing required fields: modelId, horizon' },
        { status: 400 }
      );
    }

    console.log('[FORECAST] Generating forecast for model:', modelId, 'horizon:', horizon);
    
    const forecast = await salesIntelligenceService.runForecast(modelId, horizon);
    
    console.log('[FORECAST] Forecast generated:', forecast.id);
    
    // Update status to PENDING_APPROVAL so it appears in "Pending Forecast Approvals"
    await prisma.forecastResult.update({
      where: { id: forecast.id },
      data: { status: 'PENDING_APPROVAL' }
    });
    
    return NextResponse.json({ forecast }, { status: 201 });
  } catch (error) {
    const e = error as Error;
    console.error('[FORECAST] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.ADMIN]);

// GET /api/sales/forecast - List forecasts (optional, for dashboard)
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const modelId = url.searchParams.get('modelId');
    
    // If modelId provided, get forecasts for that model
    // Otherwise return all recent forecasts
    const { prisma } = await import('@/lib/prisma');
    
    const forecasts = await (prisma as any).forecastResult?.findMany({
      where: modelId ? { modelId } : {},
      orderBy: { generatedAt: 'desc' },
      take: 20,
    }) || [];
    
    return NextResponse.json({ forecasts });
  } catch (error) {
    const e = error as Error;
    console.error('[FORECAST] Error listing forecasts:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.ADMIN, Role.EXECUTIVE]);
