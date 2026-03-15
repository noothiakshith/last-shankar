import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { Role } from '@prisma/client';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const ledger = await prisma.stockLedger.findMany({
      include: { material: true },
      orderBy: { occurredAt: 'desc' },
      take: 50
    });
    return NextResponse.json(ledger);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}, [Role.INVENTORY_MANAGER, Role.ADMIN]);
