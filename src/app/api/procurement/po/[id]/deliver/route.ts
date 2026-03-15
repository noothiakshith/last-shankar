import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { procurementService } from '@/modules/procurement/procurementService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procurement/po/[id]/deliver
 * 
 * Confirm delivery of a purchase order.
 * Requires PROCUREMENT_OFFICER role.
 * 
 * Body: { receivedQty: number }
 * 
 * Requirements: 9.5
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const { receivedQty } = body;

      if (typeof receivedQty !== 'number' || receivedQty < 0) {
        return NextResponse.json(
          { error: 'Invalid receivedQty: must be a non-negative number' },
          { status: 400 }
        );
      }

      const po = await procurementService.confirmDelivery(id, receivedQty);
      return NextResponse.json(po, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.PROCUREMENT_OFFICER])(req);
}
