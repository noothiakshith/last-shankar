import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { inventoryService } from '@/modules/inventory/inventoryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/shortages/[planId]
 * 
 * Detect shortages for a production plan.
 * Requires INVENTORY_MANAGER or PRODUCTION_PLANNER role.
 * 
 * Requirements: 8.3
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  return withAuth(async () => {
    try {
      const { planId } = await params;

      const shortageReport = await inventoryService.detectShortages(planId);
      return NextResponse.json(shortageReport, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.INVENTORY_MANAGER, Role.PRODUCTION_PLANNER, Role.ADMIN])(req);
}
