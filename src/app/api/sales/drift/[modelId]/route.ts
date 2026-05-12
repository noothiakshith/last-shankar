import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { feedbackService } from '@/modules/sales/feedbackService';

/**
 * GET /api/sales/drift/[modelId]
 * Get model accuracy metrics and drift status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { modelId: string } }
) {
  const session = await getServerSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!['SALES_ANALYST', 'EXECUTIVE', 'ADMIN'].includes(userRole)) {
    return NextResponse.json(
      { error: 'Forbidden: requires SALES_ANALYST, EXECUTIVE, or ADMIN role' },
      { status: 403 }
    );
  }

  try {
    const { modelId } = params;

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
    }

    const accuracy = await feedbackService.getModelAccuracy(modelId);

    return NextResponse.json({
      success: true,
      accuracy
    });

  } catch (error: any) {
    console.error('Error getting model drift status:', error);
    
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to get model drift status' },
      { status: 500 }
    );
  }
}
