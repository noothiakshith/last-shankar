import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { productionPlanningService } from '@/modules/production/productionPlanningService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/production/mrp
 * 
 * Run MRP (Material Requirements Planning) from an approved forecast.
 * Requires PRODUCTION_PLANNER role.
 * 
 * Requirements: 7.1
 */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { forecastId } = body;

    if (!forecastId) {
      return NextResponse.json({ error: 'Missing forecastId' }, { status: 400 });
    }

    const plan = await productionPlanningService.runMRP(forecastId);
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.PRODUCTION_PLANNER, Role.ADMIN]);
