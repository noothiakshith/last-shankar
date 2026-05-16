import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { POStatus, ApprovalGateType, WorkflowState } from '@prisma/client';
import { validateBudget } from '@/modules/finance/financeService';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId, poIds } = body as { workflowId: string; poIds: string[] };

    if (!workflowId || !poIds || poIds.length === 0) {
      return NextResponse.json(
        { error: 'workflowId and poIds are required' },
        { status: 400 }
      );
    }

    // Fetch all POs by the provided poIds
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        id: { in: poIds },
        workflowRunId: workflowId
      }
    });

    // Filter to only PENDING_APPROVAL or REJECTED status (allow re-approval of rejected POs)
    const approvablePOs = pos.filter(po => 
      po.status === POStatus.PENDING_APPROVAL || po.status === POStatus.REJECTED
    );

    if (approvablePOs.length === 0) {
      return NextResponse.json(
        { message: 'No pending or rejected POs to approve', approved: [] },
        { status: 200 }
      );
    }

    // Check if any rejected POs are being approved
    const rejectedPOs = approvablePOs.filter(po => po.status === POStatus.REJECTED);
    const hasRejectedPOs = rejectedPOs.length > 0;

    // Sum totalCost of POs being approved
    const totalCost = approvablePOs.reduce((sum, po) => sum + po.totalCost, 0);

    // Validate budget for the total
    const budgetAllowed = await validateBudget(totalCost, 'PROCUREMENT');

    if (!budgetAllowed) {
      return NextResponse.json(
        { error: 'Insufficient budget for approval', totalCost },
        { status: 400 }
      );
    }

    // In a transaction: approve all POs + increment budget committed
    const result = await prisma.$transaction(async (tx) => {
      // Approve all POs
      const approvedPOs = await Promise.all(
        approvablePOs.map(po =>
          tx.purchaseOrder.update({
            where: { id: po.id },
            data: {
              status: POStatus.APPROVED,
              approvedBy: 'finance-manager-user',
              approvedAt: new Date()
            }
          })
        )
      );

      // Increment budget committed
      await tx.budget.update({
        where: { costCenter: 'PROCUREMENT' },
        data: {
          committed: { increment: totalCost }
        }
      });

      return approvedPOs;
    });

    // Check if ALL POs for this workflowRunId are now APPROVED
    const allPOs = await prisma.purchaseOrder.findMany({
      where: { workflowRunId: workflowId }
    });

    const allApproved = allPOs.every(po => po.status === POStatus.APPROVED);

    if (allApproved) {
      // Resolve PO_APPROVAL gate
      const gate = await prisma.approvalGate.findFirst({
        where: {
          workflowRunId: workflowId,
          gateType: ApprovalGateType.PO_APPROVAL,
          status: 'PENDING'
        }
      });

      if (gate) {
        await orchestratorService.resolveApproval(gate.id, 'FINANCE_MANAGER' as Role, 'finance-manager-user', true);
      }

      // Advance workflow through FINANCE_REVIEW to PENDING_PRODUCTION_AUTH
      const workflow = await prisma.workflowRun.findUnique({
        where: { id: workflowId }
      });

      if (workflow && workflow.state === WorkflowState.PENDING_PO_APPROVAL) {
        await orchestratorService.advanceState(workflowId, 'APPROVE_FINANCE');
        
        // Request PRODUCTION_AUTHORIZATION gate
        await orchestratorService.requestApproval(
          workflowId,
          ApprovalGateType.PRODUCTION_AUTHORIZATION,
          'PRODUCTION_PLANNER' as any
        );
      }
    }

    return NextResponse.json({
      success: true,
      approved: result,
      totalCost,
      allApproved,
      hasRejectedPOs,
      rejectedCount: rejectedPOs.length,
      message: hasRejectedPOs
        ? `⚠️ Approved ${result.length} POs (including ${rejectedPOs.length} previously rejected). ${allApproved ? 'Workflow advanced to PENDING_PRODUCTION_AUTH.' : 'Waiting for remaining POs.'}`
        : allApproved 
          ? 'All POs approved. Workflow advanced to PENDING_PRODUCTION_AUTH.'
          : 'POs approved. Waiting for remaining POs.'
    });
  } catch (error) {
    console.error('Error approving PO batch:', error);
    return NextResponse.json(
      { error: 'Failed to approve PO batch' },
      { status: 500 }
    );
  }
}
