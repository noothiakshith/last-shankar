import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { productionPlanningService } from '@/modules/production/productionPlanningService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/production/plan/[id]/authorize
 * 
 * Authorize a production plan.
 * Sets status to AUTHORIZED and records who authorized it.
 * Requires PRODUCTION_PLANNER role.
 * 
 * Requirements: 7.5
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request, token) => {
    try {
      const { id } = await params;

      if (!id) {
        return NextResponse.json({ error: 'Missing plan ID' }, { status: 400 });
      }

      const plan = await productionPlanningService.authorizePlan(id, token.id);
      return NextResponse.json(plan, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.PRODUCTION_PLANNER, Role.ADMIN])(req);
}
