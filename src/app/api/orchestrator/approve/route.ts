import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, token) => {
  try {
    const body = await req.json();
    const { gateId, approved } = body;
    
    if (!gateId || typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'Missing gateId or approved status' }, { status: 400 });
    }

    const updatedGate = await orchestratorService.resolveApproval(gateId, token.role, token.id, approved);
    return NextResponse.json(updatedGate);
  } catch (error) {
    const e = error as Error;
    if (e.message && e.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [
  Role.EXECUTIVE,
  Role.FINANCE_MANAGER,
  Role.INVENTORY_MANAGER,
  Role.PROCUREMENT_OFFICER,
  Role.PRODUCTION_PLANNER,
  Role.SALES_ANALYST
]);
