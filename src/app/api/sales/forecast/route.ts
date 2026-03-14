import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { modelId, horizon } = body;

    if (!modelId || !horizon) {
      return NextResponse.json({ error: 'Missing modelId or horizon' }, { status: 400 });
    }

    const forecast = await salesIntelligenceService.runForecast(modelId, horizon);
    return NextResponse.json(forecast, { status: 201 });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.ADMIN]);
