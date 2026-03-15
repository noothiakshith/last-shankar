import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { procurementService } from '@/modules/procurement/procurementService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procurement/po/[id]
 * 
 * Get purchase order status.
 * Requires PROCUREMENT_OFFICER or FINANCE_MANAGER role.
 * 
 * Requirements: 9.3
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;

      const po = await procurementService.getPOStatus(id);
      return NextResponse.json(po, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.PROCUREMENT_OFFICER, Role.FINANCE_MANAGER])(req);
}
