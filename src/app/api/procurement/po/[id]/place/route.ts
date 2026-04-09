import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { procurementService } from '@/modules/procurement/procurementService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procurement/po/[id]/place
 * 
 * Place an approved purchase order (move to ORDERED).
 * Requires PROCUREMENT_OFFICER role.
 * 
 * Requirements: 9.4
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const po = await procurementService.placeOrder(id);
      return NextResponse.json(po, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.PROCUREMENT_OFFICER, Role.ADMIN])(req);
}
