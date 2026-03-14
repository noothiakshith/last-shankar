import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { productionPlanningService } from '@/modules/production/productionPlanningService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/production/plan/[id]/readiness
 * 
 * Check production readiness for a plan.
 * Returns a report indicating whether all required materials are available.
 * Requires PRODUCTION_PLANNER role.
 * 
 * Requirements: 7.4
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;

      if (!id) {
        return NextResponse.json({ error: 'Missing plan ID' }, { status: 400 });
      }

      const report = await productionPlanningService.checkProductionReadiness(id);
      return NextResponse.json(report, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.PRODUCTION_PLANNER, Role.ADMIN])(req);
}
