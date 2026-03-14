import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, _token) => {
  try {
    const runId = req.nextUrl.pathname.split('/').pop();
    
    if (!runId) {
      return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
    }

    const status = await orchestratorService.getWorkflowStatus(runId);
    if (!status) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(status);
  } catch (error) {
    const e = error as Error;
    if (e.name === 'NotFoundError' || e.message.includes('No WorkflowRun found')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
