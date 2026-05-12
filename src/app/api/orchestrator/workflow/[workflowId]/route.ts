import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params;

    const workflow = await prisma.workflowRun.findUnique({
      where: { id: workflowId },
      include: {
        events: {
          orderBy: { occurredAt: 'asc' }
        },
        approvals: true,
        allocatedEmployee: {
          select: {
            id: true,
            name: true,
            department: true,
            email: true
          }
        }
      }
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: workflow.id,
      type: workflow.type,
      state: workflow.state,
      payload: workflow.payload,
      triggeredBy: workflow.triggeredBy,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      allocatedEmployee: workflow.allocatedEmployee,
      events: workflow.events,
      approvals: workflow.approvals
    });
  } catch (error) {
    console.error('Error fetching workflow detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow detail' },
      { status: 500 }
    );
  }
}
