import { NextRequest, NextResponse } from 'next/server';
import { ModelType } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    console.log('[TRAIN] Received training request');
    const body = await req.json();
    console.log('[TRAIN] Request body:', body);
    
    const { type, productId, region } = body;

    if (!type || !productId || !region) {
      console.log('[TRAIN] Missing required fields');
      return NextResponse.json({ error: 'Missing type, productId, or region' }, { status: 400 });
    }

    console.log('[TRAIN] Starting model training...');
    const model = await salesIntelligenceService.trainModel({
      type: type as ModelType,
      productId,
      region,
    });

    console.log('[TRAIN] Training successful:', model.id);
    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    const e = error as Error;
    console.error('[TRAIN] Error:', e.message);
    console.error('[TRAIN] Stack:', e.stack);
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
