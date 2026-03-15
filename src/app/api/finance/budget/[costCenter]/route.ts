import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { getBudgetSummary } from '@/modules/finance/financeService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ costCenter: string }> }
) {
  return withAuth(async () => {
    try {
      const { costCenter } = await params;
      
      const budget = await getBudgetSummary(costCenter);

      return NextResponse.json(budget, { status: 200 });
    } catch (error) {
      const e = error as Error;
      if (e.message === 'Budget not found') {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.FINANCE_MANAGER, Role.EXECUTIVE, Role.ADMIN])(req);
}
