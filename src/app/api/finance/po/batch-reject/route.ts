import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { POStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId } = body as { workflowId: string };

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      );
    }

    // Find all PENDING_APPROVAL POs for this workflowRunId
    const pendingPOs = await prisma.purchaseOrder.findMany({
      where: {
        workflowRunId: workflowId,
        status: POStatus.PENDING_APPROVAL
      }
    });

    if (pendingPOs.length === 0) {
      return NextResponse.json(
        { message: 'No pending POs to reject', rejected: [] },
        { status: 200 }
      );
    }

    // Reject all POs (but keep them visible, don't advance workflow)
    const rejectedPOs = await Promise.all(
      pendingPOs.map(po =>
        prisma.purchaseOrder.update({
          where: { id: po.id },
          data: { status: POStatus.REJECTED }
        })
      )
    );

    // NOTE: We do NOT resolve the approval gate or advance the workflow
    // The POs stay rejected and visible so finance can re-approve them later if needed

    return NextResponse.json({
      success: true,
      rejected: rejectedPOs,
      message: `Rejected ${rejectedPOs.length} PO(s). They remain visible for future approval.`
    });
  } catch (error) {
    console.error('Error rejecting PO batch:', error);
    return NextResponse.json(
      { error: 'Failed to reject PO batch' },
      { status: 500 }
    );
  }
}
