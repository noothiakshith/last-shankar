import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { procurementService } from '@/modules/procurement/procurementService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/procurement/po/[id]/submit
 * 
 * Submit a purchase order for approval.
 * Requires PROCUREMENT_OFFICER role.
 * 
 * Body: { workflowRunId: string }
 * 
 * Requirements: 9.4
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (request, token) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const { workflowRunId } = body;

      if (!workflowRunId) {
        return NextResponse.json(
          { error: 'Missing required field: workflowRunId' },
          { status: 400 }
        );
      }

      const po = await procurementService.submitPOForApproval(id, workflowRunId);
      return NextResponse.json(po, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.PROCUREMENT_OFFICER])(req);
}
