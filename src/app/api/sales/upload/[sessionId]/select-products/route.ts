import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Mistral } from '@mistralai/mistralai';

const apiKey = process.env.MISTRAL_API_KEY || '';
const client = apiKey ? new Mistral({ apiKey }) : null;

interface ProductStats {
  productId: string;
  region?: string;
  totalQuantity: number;
  totalRevenue: number;
  uniqueDays: number;
  avgDailyQty: number;
  stdDailyQty: number;
  cv: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  firstSale: string;
  lastSale: string;
  compositeScore: number;
}

interface SelectedProduct {
  rank: number;
  productId: string;
  region?: string;
  totalQuantity: number;
  totalRevenue: number;
  cv: number;
  trend: string;
  uniqueDays: number;
  score: number;
}

interface ModelRecommendation {
  model: 'LINEAR_REGRESSION' | 'RANDOM_FOREST' | 'XGBOOST' | 'ARIMA';
  reason: string;
}

export async function POST(
  _req: NextRequest,
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
    const productStats: ProductStats[] = profileData.productStats || [];

    if (productStats.length === 0) {
      return NextResponse.json(
        { error: 'No products found in profile data' },
        { status: 400 }
      );
    }

    // Step 1: Score all products with composite algorithm
    // Already scored in analysis, but we'll apply diversity penalty here
    const scoredProducts = productStats.map(p => ({
      ...p,
      originalScore: p.compositeScore,
      adjustedScore: p.compositeScore,
    }));

    // Step 2: Apply diversity rule - penalize products from same region
    const selectedProducts: typeof scoredProducts = [];
    const selectedRegions = new Set<string>();

    // Sort by original score
    scoredProducts.sort((a, b) => b.originalScore - a.originalScore);

    // Pick top 5 with diversity penalty
    for (const product of scoredProducts) {
      if (selectedProducts.length >= 5) break;

      // Apply 20% penalty if region already selected
      let adjustedScore = product.originalScore;
      if (product.region && selectedRegions.has(product.region)) {
        adjustedScore *= 0.8;
      }

      product.adjustedScore = adjustedScore;

      // Add to selection
      selectedProducts.push(product);
      if (product.region) {
        selectedRegions.add(product.region);
      }

      // Re-sort remaining products by adjusted score
      scoredProducts.sort((a, b) => {
        const aScore = selectedRegions.has(a.region || '') ? a.originalScore * 0.8 : a.originalScore;
        const bScore = selectedRegions.has(b.region || '') ? b.originalScore * 0.8 : b.originalScore;
        return bScore - aScore;
      });
    }

    // Step 3: Format selected products
    const formattedProducts: SelectedProduct[] = selectedProducts.map((p, idx) => ({
      rank: idx + 1,
      productId: p.productId,
      region: p.region,
      totalQuantity: p.totalQuantity,
      totalRevenue: p.totalRevenue,
      cv: p.cv,
      trend: p.trend,
      uniqueDays: p.uniqueDays,
      score: Math.round(p.adjustedScore * 100) / 100,
    }));

    // Step 4: Get LLM model recommendations
    let recommendations: Record<string, ModelRecommendation> = {};

    if (client) {
      try {
        const prompt = `You are a forecasting expert. For each of these ${formattedProducts.length} products, recommend the best forecasting model from: LINEAR_REGRESSION, RANDOM_FOREST, XGBOOST, ARIMA.

Consider these data characteristics for each product:
${formattedProducts.map(p => `
Product: ${p.productId}
- Data Points: ${p.uniqueDays} days
- Total Volume: ${p.totalQuantity} units
- Total Revenue: $${p.totalRevenue}
- Demand Variability (CV): ${p.cv.toFixed(2)} ${p.cv < 0.2 ? '(low)' : p.cv < 0.4 ? '(moderate)' : '(high)'}
- Trend: ${p.trend}
`).join('\n')}

For each product, respond in this exact JSON format:
{
  "PROD-XXX": {
    "model": "MODEL_NAME",
    "reason": "One sentence explanation"
  }
}

Guidelines:
- LINEAR_REGRESSION: Best for stable, low-variance demand with clear linear trends
- RANDOM_FOREST: Best for moderate variability with non-linear patterns
- XGBOOST: Best for high volume with complex interactions and seasonality
- ARIMA: Best for time-series with strong autocorrelation and sufficient data points (>30 days)

Respond ONLY with valid JSON, no markdown formatting.`;

        const response = await client.chat.complete({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: 'You are a forecasting expert. Respond only with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
          const content = response.choices[0].message.content as string;
          // Try to parse JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            recommendations = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (e) {
        console.error('LLM recommendation failed:', e);
        // Fall through to default recommendations
      }
    }

    // Step 5: Apply default recommendations if LLM failed
    if (Object.keys(recommendations).length === 0) {
      formattedProducts.forEach(p => {
        let model: ModelRecommendation['model'] = 'XGBOOST';
        let reason = 'Default recommendation for robust forecasting.';

        // Simple heuristic-based defaults
        if (p.cv < 0.2 && p.trend === 'STABLE') {
          model = 'LINEAR_REGRESSION';
          reason = 'Low variability and stable trend suggest linear model.';
        } else if (p.uniqueDays >= 30 && p.trend !== 'STABLE') {
          model = 'ARIMA';
          reason = 'Sufficient data points with trend suggest time-series model.';
        } else if (p.cv >= 0.3) {
          model = 'RANDOM_FOREST';
          reason = 'High variability suggests ensemble method for robustness.';
        }

        recommendations[p.productId] = { model, reason };
      });
    }

    // Step 6: Update session with selected products and recommendations
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        status: 'PRODUCTS_SELECTED',
        selectedProducts: formattedProducts,
        llmRecommendations: recommendations,
      },
    });

    return NextResponse.json({
      sessionId,
      selectedProducts: formattedProducts,
      recommendations,
    });
  } catch (error) {
    console.error('Product selection error:', error);
    return NextResponse.json(
      {
        error: 'Failed to select products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
