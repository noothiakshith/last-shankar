import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';

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
    
    return NextResponse.json(forecast);
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.EXECUTIVE, Role.ADMIN]);
