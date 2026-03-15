import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { procurementService } from '@/modules/procurement/procurementService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procurement/po
 * 
 * Create a new purchase order.
 * Requires PROCUREMENT_OFFICER role.
 * 
 * Body: { supplierId: string, materialId: string, quantity: number, unitCost: number }
 * 
 * Requirements: 9.2
 */
export async function POST(req: NextRequest) {
  return withAuth(async () => {
    try {
      const body = await req.json();
      const { supplierId, materialId, quantity, unitCost } = body;

      if (!supplierId || !materialId) {
        return NextResponse.json(
          { error: 'Missing required fields: supplierId, materialId' },
          { status: 400 }
        );
      }

      if (typeof quantity !== 'number' || quantity <= 0) {
        return NextResponse.json(
          { error: 'Invalid quantity: must be a positive number' },
          { status: 400 }
        );
      }

      if (typeof unitCost !== 'number' || unitCost <= 0) {
        return NextResponse.json(
          { error: 'Invalid unitCost: must be a positive number' },
          { status: 400 }
        );
      }

      const po = await procurementService.createPurchaseOrder({
        supplierId,
        materialId,
        quantity,
        unitCost
      });

      return NextResponse.json(po, { status: 201 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.PROCUREMENT_OFFICER])(req);
}
