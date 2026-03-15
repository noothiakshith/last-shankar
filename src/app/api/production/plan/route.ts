import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/production/plan
 * 
 * Get all production plans.
 * Requires PRODUCTION_PLANNER role.
 */
export const GET = withAuth(async () => {
  try {
    const plans = await prisma.productionPlan.findMany({
      include: {
        orders: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(plans, { status: 200 });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.PRODUCTION_PLANNER, Role.ADMIN]);
