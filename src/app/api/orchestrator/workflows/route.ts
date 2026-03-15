import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orchestrator/workflows
 * 
 * Get all workflow runs with their events and approvals.
 * Requires authenticated user.
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const status = url.searchParams.get('status');

    const where = status ? { state: status as any } : {};

    const workflows = await prisma.workflowRun.findMany({
      where,
      include: {
        events: {
          orderBy: { occurredAt: 'desc' },
          take: 5
        },
        approvals: {
          where: { status: 'PENDING' }
        },
        allocatedEmployee: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json(workflows, { status: 200 });
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
  Role.SALES_ANALYST,
  Role.ADMIN
]);
