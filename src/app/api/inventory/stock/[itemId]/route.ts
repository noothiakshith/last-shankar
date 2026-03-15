import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { inventoryService } from '@/modules/inventory/inventoryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/stock/[itemId]
 * 
 * Get current stock level for a material.
 * Requires INVENTORY_MANAGER role.
 * 
 * Requirements: 8.1, 8.2
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  return withAuth(async () => {
    try {
      const { itemId } = await params;

      const stockLevel = await inventoryService.getStockLevel(itemId);
      return NextResponse.json(stockLevel, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.INVENTORY_MANAGER, Role.ADMIN])(req);
}

/**
 * POST /api/inventory/stock/[itemId]
 * 
 * Update stock by appending a ledger entry.
 * Requires INVENTORY_MANAGER role.
 * 
 * Body: { delta: number, reason: string, reference?: string }
 * 
 * Requirements: 8.1, 8.2
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  return withAuth(async () => {
    try {
      const { itemId } = await params;
      const body = await req.json();
      const { delta, reason, reference } = body;

      if (typeof delta !== 'number') {
        return NextResponse.json({ error: 'Missing or invalid delta' }, { status: 400 });
      }

      if (!reason) {
        return NextResponse.json({ error: 'Missing reason' }, { status: 400 });
      }

      const stockLevel = await inventoryService.updateStock(itemId, delta, reason, reference);
      return NextResponse.json(stockLevel, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.INVENTORY_MANAGER, Role.ADMIN])(req);
}
