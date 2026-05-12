import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { salesIntelligenceService } from '@/modules/sales/salesIntelligenceService';
import { ModelType } from '@prisma/client';
import { Mistral } from '@mistralai/mistralai';

const apiKey = process.env.MISTRAL_API_KEY || '';
const client = apiKey ? new Mistral({ apiKey }) : null;

interface TrainingResult {
  productId: string;
  region: string;
  modelType: string;
  modelId?: string;
  metrics?: {
    mae: number;
    rmse: number;
    r2Score: number;
  };
  dataPoints: number;
  trainingTime: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Get the upload session with selected products
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
      include: {
        stagedRecords: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.selectedProducts) {
      return NextResponse.json(
        { error: 'No products selected. Run product selection first.' },
        { status: 400 }
      );
    }

    const selectedProducts = session.selectedProducts as any[];
    const recommendations = (session.llmRecommendations as any) || {};

    // Update status to TRAINING
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: { status: 'TRAINING' },
    });

    const results: TrainingResult[] = [];
    const trainedModelIds: Record<string, string> = {};

    // Process each selected product
    for (const product of selectedProducts) {
      const startTime = Date.now();
      const productId = product.productId;
      const region = product.region || 'Default';
      
      // Get model type from recommendations or default to XGBOOST
      const recommendedModel = recommendations[productId]?.model || 'XGBOOST';
      const modelType = recommendedModel as ModelType;

      // Try to find the product column by checking common names
      const firstRecord = session.stagedRecords[0];
      const rawData = firstRecord?.rawData as Record<string, string>;
      const possibleProductColumns = ['productId', 'product_id', 'Product_ID', 'product', 'Product', 'sku', 'SKU', 'item_id', 'itemId'];
      let productColumn = 'productId'; // default
      
      if (rawData) {
        for (const col of possibleProductColumns) {
          if (col in rawData) {
            productColumn = col;
            break;
          }
        }
      }

      // Step 1: Get staged records for this product (moved outside try block for catch access)
      const stagedRecords = session.stagedRecords.filter((record: any) => {
        const data = record.rawData as Record<string, string>;
        return data[productColumn] === productId;
      });

      try {

        if (stagedRecords.length === 0) {
          results.push({
            productId,
            region,
            modelType,
            dataPoints: 0,
            trainingTime: '0s',
            status: 'FAILED',
            error: `No data found for this product (looked in column: ${productColumn})`,
          });
          continue;
        }

        // Step 1.5: Look up the actual product by SKU (CSV uses SKU, DB uses ID)
        const product = await prisma.product.findFirst({
          where: { sku: productId }
        });

        if (!product) {
          results.push({
            productId,
            region,
            modelType,
            dataPoints: stagedRecords.length,
            trainingTime: '0s',
            status: 'FAILED',
            error: `Product with SKU ${productId} not found in database. Please ensure products exist before training.`,
          });
          continue;
        }

        const actualProductId = product.id;

        // Step 2: Check if data already exists in SalesRecord, if not insert
        // Note: We use the training region (Default) for all records to match the query in trainModel()
        const existingRecords = await prisma.salesRecord.findMany({
          where: {
            productId: actualProductId,
            region,
            source: 'csv_upload',
          },
        });

        if (existingRecords.length === 0) {
          // Insert staged records into SalesRecord
          // Auto-detect column names from the first record
          const sampleData = stagedRecords[0].rawData as Record<string, string>;
          const columns = Object.keys(sampleData);
          
          const dateColumn = columns.find(c => ['date', 'Date', 'DATE', 'timestamp', 'time'].includes(c)) || 'date';
          const quantityColumn = columns.find(c => ['quantity', 'Quantity', 'qty', 'Qty', 'units', 'amount'].includes(c)) || 'quantity';
          const revenueColumn = columns.find(c => ['revenue', 'Revenue', 'sales', 'Sales', 'price', 'total'].includes(c)) || 'revenue';

          const recordsToInsert = stagedRecords.map((staged: any) => {
            const rawData = staged.rawData as Record<string, string>;
            return {
              productId: actualProductId, // Use the actual product ID, not the SKU
              region, // Use the training region (Default) for all records
              date: new Date(rawData[dateColumn]),
              quantity: parseInt(rawData[quantityColumn]) || 0,
              revenue: parseFloat(rawData[revenueColumn]) || 0,
              source: 'csv_upload',
            };
          });

          await prisma.salesRecord.createMany({
            data: recordsToInsert,
            skipDuplicates: true,
          });
        }

        // Step 3: Train the model using existing service
        const trainedModel = await salesIntelligenceService.trainModel({
          type: modelType,
          productId: actualProductId, // Use the actual product ID
          region,
        });

        const trainingTime = ((Date.now() - startTime) / 1000).toFixed(1);

        results.push({
          productId,
          region,
          modelType,
          modelId: trainedModel.id,
          metrics: {
            mae: trainedModel.mae,
            rmse: trainedModel.rmse,
            r2Score: trainedModel.r2Score,
          },
          dataPoints: stagedRecords.length,
          trainingTime: `${trainingTime}s`,
          status: 'SUCCESS',
        });

        trainedModelIds[productId] = trainedModel.id;
      } catch (error) {
        const trainingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        results.push({
          productId,
          region,
          modelType,
          dataPoints: stagedRecords.length,
          trainingTime: `${trainingTime}s`,
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Calculate summary
    const succeeded = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const bestModel = results
      .filter(r => r.status === 'SUCCESS' && r.metrics)
      .sort((a, b) => (b.metrics?.r2Score || 0) - (a.metrics?.r2Score || 0))[0];

    const summary = {
      total: results.length,
      succeeded,
      failed,
      bestModel: bestModel
        ? {
            productId: bestModel.productId,
            r2Score: bestModel.metrics?.r2Score || 0,
          }
        : null,
    };

    // Step 4: Get LLM training summary
    let llmTrainingSummary = '';
    if (client && succeeded > 0) {
      try {
        const successfulResults = results.filter(r => r.status === 'SUCCESS');
        const prompt = `Here are the training results for ${successfulResults.length} forecasting models. Summarize which models performed best, which struggled, and what this means for forecasting reliability. Be concise (2-3 sentences).

${successfulResults.map(r => `
Product: ${r.productId}
Model: ${r.modelType}
MAE: ${r.metrics?.mae.toFixed(2)}
RMSE: ${r.metrics?.rmse.toFixed(2)}
R²: ${r.metrics?.r2Score.toFixed(2)}
Data Points: ${r.dataPoints}
`).join('\n')}

Respond with a brief summary focusing on accuracy and reliability.`;

        const response = await client.chat.complete({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: 'You are a forecasting expert. Provide concise summaries.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
          llmTrainingSummary = response.choices[0].message.content as string;
        }
      } catch (e) {
        console.error('LLM training summary failed:', e);
      }
    }

    // Fallback summary if LLM fails
    if (!llmTrainingSummary && succeeded > 0) {
      const avgR2 = results
        .filter(r => r.status === 'SUCCESS' && r.metrics)
        .reduce((sum, r) => sum + (r.metrics?.r2Score || 0), 0) / succeeded;
      
      llmTrainingSummary = `All ${succeeded} models trained successfully with an average R² of ${avgR2.toFixed(2)}. ${
        bestModel
          ? `${bestModel.modelType} on ${bestModel.productId} achieved the highest accuracy (R²=${bestModel.metrics?.r2Score.toFixed(2)}).`
          : ''
      } Models are ready for forecasting.`;
    }

    // Update session with training results
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        status: 'TRAINED',
        trainedModelIds,
      },
    });

    return NextResponse.json({
      sessionId,
      status: 'TRAINED',
      results,
      summary,
      llmTrainingSummary,
    });
  } catch (error) {
    console.error('Training error:', error);
    
    // Update session status to failed
    try {
      const { sessionId } = await params;
      await prisma.uploadSession.update({
        where: { id: sessionId },
        data: { status: 'FAILED' },
      });
    } catch (e) {
      console.error('Failed to update session status:', e);
    }

    return NextResponse.json(
      {
        error: 'Failed to train models',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
