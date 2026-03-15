import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { llmService } from '@/modules/llm/llmService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const explanation = await llmService.explainForecast(id);
      return NextResponse.json({ explanation }, { status: 200 });
    } catch (error) {
      const e = error as Error;
      if (e.message.includes('not found')) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }, [Role.SALES_ANALYST, Role.EXECUTIVE, Role.ADMIN])(req);
}
