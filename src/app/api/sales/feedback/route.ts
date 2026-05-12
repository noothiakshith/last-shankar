import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';
import { feedbackService } from '@/modules/sales/feedbackService';

/**
 * POST /api/sales/feedback
 * Record actual sales data and trigger feedback loop
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!['SALES_ANALYST', 'ADMIN'].includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden: requires SALES_ANALYST or ADMIN role' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { productId, region, date, quantity, revenue } = body;

    if (!productId || !region || !date || quantity === undefined || revenue === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, region, date, quantity, revenue' },
        { status: 400 }
      );
    }

    // Record the actual sales data
    const salesRecord = await salesIntelligenceService.recordActuals({
      productId,
      region,
      date: new Date(date),
      quantity,
      revenue,
      source: 'Manual Entry'
    });

    // Record feedback and check for drift
    await feedbackService.recordActualFeedback({
      productId,
      region,
      date: new Date(date),
      actualQty: quantity
    });

    return NextResponse.json({
      success: true,
      salesRecord,
      message: 'Actual sales recorded and feedback loop triggered'
    });

  } catch (error: any) {
    console.error('Error recording sales feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record sales feedback' },
      { status: 500 }
    );
  }
}
