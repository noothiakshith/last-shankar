import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { recordExpense } from '@/modules/finance/financeService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withAuth(async (request) => {
    try {
      const body = await request.json();
      const { costCenter, amount, description, reference } = body;

      if (!costCenter || typeof amount !== 'number' || !description) {
        return NextResponse.json(
          { error: 'Missing required fields: costCenter, amount, description' },
          { status: 400 }
        );
      }

      const expense = await recordExpense({ costCenter, amount, description, reference });

      return NextResponse.json(expense, { status: 201 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }, [Role.FINANCE_MANAGER, Role.ADMIN])(req);
}
