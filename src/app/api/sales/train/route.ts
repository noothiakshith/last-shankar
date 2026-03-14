import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role, ModelType } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { type, productId, region } = body;

    if (!type || !productId || !region) {
      return NextResponse.json({ error: 'Missing type, productId, or region' }, { status: 400 });
    }

    const model = await salesIntelligenceService.trainModel({
      type: type as ModelType,
      productId,
      region,
    });

    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.ADMIN]);
