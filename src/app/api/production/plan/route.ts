import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/production/plan
 * 
 * Get all production plans.
 * Requires PRODUCTION_PLANNER role.
 */
export const GET = withAuth(async () => {
  try {
    const plans = await prisma.productionPlan.findMany({
      include: {
        orders: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Find active workflow runs for these plans to show in the UI
    const workflowRuns = await prisma.workflowRun.findMany({
      where: {
        state: { notIn: ['COMPLETED', 'FAILED', 'REJECTED'] }
      },
      include: {
        allocatedEmployee: true
      }
    });

    const plansWithRuns = plans.map(plan => {
      const run = workflowRuns.find(r => (r.payload as any)?.planId === plan.id);
      return {
        ...plan,
        activeWorkflowRun: run ? { 
          id: run.id, 
          state: run.state,
          allocatedEmployee: run.allocatedEmployee ? {
            name: run.allocatedEmployee.name,
            role: run.allocatedEmployee.role
          } : null
        } : null
      };
    });

    return NextResponse.json(plansWithRuns, { status: 200 });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.PRODUCTION_PLANNER, Role.ADMIN]);
