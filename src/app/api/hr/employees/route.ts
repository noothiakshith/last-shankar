import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { hrService } from '@/modules/hr/hrService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    try {
      const department = req.nextUrl.searchParams.get('department');
      const employees = await hrService.listEmployeesByDepartment(department);
      return NextResponse.json(employees, { status: 200 });
    } catch (error) {
      const e = error as Error;
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.ADMIN, Role.EXECUTIVE, Role.PRODUCTION_PLANNER, Role.FINANCE_MANAGER])(req);
}
