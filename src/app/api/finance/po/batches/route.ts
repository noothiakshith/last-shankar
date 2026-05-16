import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { POStatus } from '@prisma/client';

export async function GET() {
  try {
    // Query all POs with status PENDING_APPROVAL, APPROVED, or REJECTED
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: [POStatus.PENDING_APPROVAL, POStatus.APPROVED, POStatus.REJECTED]
        }
      },
      include: {
        workflowRun: true,
        supplier: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by workflowRunId
    const batchMap = new Map<string, typeof pos>();
    const unlinked: typeof pos = [];

    for (const po of pos) {
      if (po.workflowRunId) {
        const existing = batchMap.get(po.workflowRunId) || [];
        existing.push(po);
        batchMap.set(po.workflowRunId, existing);
      } else {
        unlinked.push(po);
      }
    }

    // Calculate batch summaries
    const batches = Array.from(batchMap.entries()).map(([workflowId, poList]) => {
      const batchTotal = poList.reduce((sum, po) => sum + po.totalCost, 0);
      const pendingCount = poList.filter(po => po.status === POStatus.PENDING_APPROVAL).length;
      const approvedCount = poList.filter(po => po.status === POStatus.APPROVED).length;
      const rejectedCount = poList.filter(po => po.status === POStatus.REJECTED).length;
      const allApproved = pendingCount === 0 && rejectedCount === 0;

      return {
        workflowId,
        workflowRun: poList[0].workflowRun,
        pos: poList,
        batchTotal,
        pendingCount,
        approvedCount,
        rejectedCount,
        allApproved
      };
    });

    // Get budget summary
    const budget = await prisma.budget.findUnique({
      where: { costCenter: 'PROCUREMENT' }
    });

    return NextResponse.json({
      batches,
      unlinked,
      budget: budget || { totalBudget: 0, committed: 0, spent: 0, available: 0 }
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching PO batches:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to fetch PO batches', details: err.message },
      { status: 500 }
    );
  }
}
