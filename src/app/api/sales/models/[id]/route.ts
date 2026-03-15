
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';

export const DELETE = withAuth(async (_req: NextRequest, { params }: any) => {
  try {
    const { id } = await params;
    await salesIntelligenceService.deleteModel(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}, [Role.SALES_ANALYST, Role.ADMIN]);
