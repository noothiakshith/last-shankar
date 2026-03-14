import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const modelId = url.pathname.split('/').slice(-1)[0];

    if (!modelId) {
      return NextResponse.json({ error: 'Missing modelId' }, { status: 400 });
    }

    const metrics = await salesIntelligenceService.getMLOpsMetrics(modelId);
    
    return NextResponse.json(metrics);
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.EXECUTIVE, Role.ADMIN]);
