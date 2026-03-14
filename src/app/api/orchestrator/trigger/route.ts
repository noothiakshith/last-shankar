import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, token) => {
  try {
    const body = await req.json();
    const { type, payload } = body;
    
    if (!type || !payload) {
      return NextResponse.json({ error: 'Missing type or payload' }, { status: 400 });
    }

    const run = await orchestratorService.triggerWorkflow(type, token.id, payload);
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    const e = error as Error;
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
