import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { approvePO } from '@/modules/finance/financeService';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // withAuth returns a handler that we immediately call with `req`
  return withAuth(async (request, token) => {
    try {
      const { id } = await params;
      
      // Attempt to parse gateId from body if available
      let gateId: string | undefined;
      try {
        const body = await request.json();
        gateId = body.gateId;
      } catch (e) {
        // Body might be empty
      }

      await approvePO(id, token.id);

      if (gateId) {
        await orchestratorService.resolveApproval(gateId, token.role, token.id, true);
      }

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }, [Role.FINANCE_MANAGER, Role.ADMIN])(req);
}
