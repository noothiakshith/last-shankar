import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { hrService } from '@/modules/hr/hrService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const employee = await hrService.getEmployee(id);
      return NextResponse.json(employee, { status: 200 });
    } catch (error) {
      const e = error as Error;
      if (e.message === 'Employee not found') {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.ADMIN])(req);
}
