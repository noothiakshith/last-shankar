import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { productId, region, date, quantity, revenue, source } = body;

    if (!productId || !region || !date || quantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const actual = await salesIntelligenceService.recordActuals({
      productId,
      region,
      date: new Date(date),
      quantity,
      revenue: revenue || 0,
      source: source || 'MANUAL',
    });

    return NextResponse.json(actual, { status: 201 });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.ADMIN]);
