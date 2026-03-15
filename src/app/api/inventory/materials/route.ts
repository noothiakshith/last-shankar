import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { inventoryService } from '@/modules/inventory/inventoryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/materials
 * 
 * Get all materials with current stock levels calculated from ledger.
 * Requires INVENTORY_MANAGER role.
 */
export const GET = withAuth(async () => {
  try {
    const materials = await prisma.material.findMany({
      orderBy: { name: 'asc' }
    });

    // Calculate on-hand from ledger for each material
    const materialsWithStock = await Promise.all(
      materials.map(async (material) => {
        const stockLevel = await inventoryService.getStockLevel(material.id);
        return {
          id: material.id,
          sku: material.sku,
          name: material.name,
          unit: material.unit,
          onHand: stockLevel.onHand,
          safetyStock: material.safetyStock,
          reorderPoint: material.reorderPoint,
        };
      })
    );

    return NextResponse.json(materialsWithStock, { status: 200 });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.INVENTORY_MANAGER, Role.PRODUCTION_PLANNER, Role.PROCUREMENT_OFFICER, Role.ADMIN]);
