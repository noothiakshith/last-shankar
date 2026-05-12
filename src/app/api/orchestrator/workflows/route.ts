import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orchestrator/workflows
 * 
 * Get all workflow runs with their events and approvals.
 * No authentication required for demo purposes.
 */
export async function GET(req: NextRequest) {
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
}
