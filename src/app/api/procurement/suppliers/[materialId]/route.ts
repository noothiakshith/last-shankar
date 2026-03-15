import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { procurementService } from '@/modules/procurement/procurementService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procurement/suppliers/[materialId]
 * 
 * Find qualified suppliers for a material.
 * Requires PROCUREMENT_OFFICER role.
 * 
 * Requirements: 9.1
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  return withAuth(async () => {
    try {
      const { materialId } = await params;

      const suppliers = await procurementService.findSuppliers(materialId);
      return NextResponse.json(suppliers, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.PROCUREMENT_OFFICER])(req);
}
