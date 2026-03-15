import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { hrService } from '@/modules/hr/hrService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request) => {
    try {
      const { id } = await params;
      const body = await request.json().catch(() => ({}));
      const { workflowRunId } = body;

      if (!workflowRunId) {
        return NextResponse.json(
          { error: 'Missing workflowRunId' },
          { status: 400 }
        );
      }

      const allocatedRun = await hrService.allocateToWorkflow(id, workflowRunId);
      return NextResponse.json(allocatedRun, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.ADMIN])(req);
}
