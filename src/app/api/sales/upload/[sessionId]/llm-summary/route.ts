import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Mistral } from '@mistralai/mistralai';

const apiKey = process.env.MISTRAL_API_KEY || '';
const client = apiKey ? new Mistral({ apiKey }) : null;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Get the upload session with profile data
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.profileData) {
      return NextResponse.json(
        { error: 'Profile data not found. Run analysis first.' },
        { status: 400 }
      );
    }

    const profileData = session.profileData as any;

    // Build the prompt for the LLM
    const dataQuality = profileData.dataQuality;
    const topProducts = profileData.topProducts || [];
    const regionStats = profileData.regionStats || [];

    const prompt = `You are a sales data analyst. Analyze this uploaded sales dataset and provide a concise summary (3-5 sentences) covering:
1. Dataset overview (size, time range, coverage)
2. Data quality assessment
3. Key patterns in top products
4. Regional insights
5. Recommendations for forecasting focus

Dataset Overview:
- Total Records: ${dataQuality.totalRows}
- Date Range: ${dataQuality.dateRange.from} to ${dataQuality.dateRange.to}
- Unique Products: ${dataQuality.uniqueProducts}
- Unique Regions: ${dataQuality.uniqueRegions}

Data Quality:
- Missing Dates: ${dataQuality.missingDates}
- Missing Quantities: ${dataQuality.missingQuantities}
- Missing Products: ${dataQuality.missingProducts}
- Duplicate Rows: ${dataQuality.duplicates}
- Outliers: ${dataQuality.outliers}
- Quality Score: ${(dataQuality.qualityScore * 100).toFixed(1)}%

Top 5 Products by Operational Impact:
${topProducts.slice(0, 5).map((p: any, idx: number) => 
  `${idx + 1}. ${p.productId} - Quantity: ${p.totalQuantity.toLocaleString()}, Revenue: $${p.totalRevenue.toLocaleString()}, Score: ${p.score}`
).join('\n')}

Regional Breakdown:
${regionStats.map((r: any) => 
  `- ${r.region}: ${r.totalQuantity.toLocaleString()} units, $${r.totalRevenue.toLocaleString()} revenue, ${r.uniqueProducts} products`
).join('\n')}

Provide a professional summary that helps the user understand what makes this dataset valuable and where to focus forecasting efforts.`;

    let summary = '';

    if (client) {
      try {
        const response = await client.chat.complete({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: 'You are a sales data analyst providing insights on uploaded sales data. Be concise, professional, and actionable.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
          summary = response.choices[0].message.content as string;
        }
      } catch (e) {
        console.error('Mistral generation failed:', e);
        // Fall through to template
      }
    }

    // Template fallback if LLM fails or no API key
    if (!summary) {
      summary = `This dataset contains ${dataQuality.totalRows.toLocaleString()} sales records spanning from ${dataQuality.dateRange.from} to ${dataQuality.dateRange.to} across ${dataQuality.uniqueRegions} regions and ${dataQuality.uniqueProducts} products. Data quality is ${dataQuality.qualityScore >= 0.9 ? 'excellent' : dataQuality.qualityScore >= 0.7 ? 'good' : 'fair'} with a ${(dataQuality.qualityScore * 100).toFixed(1)}% quality score. The top products by operational impact are led by ${topProducts[0]?.productId || 'N/A'} which shows strong performance. ${regionStats[0]?.region || 'The primary region'} leads in volume with ${regionStats[0]?.totalQuantity.toLocaleString() || 'N/A'} units sold. I recommend focusing forecasting efforts on the top 5 products as they represent the highest operational impact and revenue potential.`;
    }

    // Update session with LLM summary
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        llmSummary: summary,
      },
    });

    return NextResponse.json({
      sessionId,
      summary,
    });
  } catch (error) {
    console.error('LLM summary error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
