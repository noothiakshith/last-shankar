/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { inventoryService } from '@/modules/inventory/inventoryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/alerts
 * 
 * Get all safety stock alerts.
 * Requires INVENTORY_MANAGER role.
 * 
 * Requirements: 8.4
 */
export const GET = withAuth(async () => {
  try {
    const alerts = await inventoryService.getSafetyStockAlerts();
    return NextResponse.json(alerts, { status: 200 });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.INVENTORY_MANAGER, Role.ADMIN]);
