import { salesIntelligenceService } from '../src/modules/sales/salesIntelligenceService';
import prisma from '../src/lib/prisma';
import { ModelType } from '@prisma/client';

async function main() {
  console.log("🧹 Clearing old ML models and forecasts...");
  await prisma.forecastResult.deleteMany();
  await prisma.trainedModel.deleteMany();

  console.log(`\n📚 Checking for Sales Data...`);
  const salesCount = await prisma.salesRecord.count({
    where: { productId: 'prod-widget-a', region: 'East' }
  });
  console.log(`Found ${salesCount} sales records for prod-widget-a in East.`);

  if (salesCount < 5) {
     console.error("Not enough sales data! Seeding might have failed or data is missing.");
     return;
  }

  const modelTypes: ModelType[] = ['LINEAR_REGRESSION', 'RANDOM_FOREST', 'XGBOOST'];
  
  for (const type of modelTypes) {
    try {
      console.log(`\n================================`);
      console.log(`🤖 Training real ${type} model via Python ML Microservice...`);
      const trainedModel = await salesIntelligenceService.trainModel({
        type: type,
        productId: 'prod-widget-a',
        region: 'East'
      });

      console.log(`✅ ${type} Model Trained Successfully!`);
      console.log(`   Model ID: ${trainedModel.id}`);
      console.log(`   MAE: ${trainedModel.mae.toFixed(4)}`);
      console.log(`   RMSE: ${trainedModel.rmse.toFixed(4)}`);
      console.log(`   R2 Score: ${trainedModel.r2Score.toFixed(4)}`);
      console.log(`   Artifact Path: ${trainedModel.artifactPath}`);

      console.log(`\n🔮 Running 30-day forecast...`);
      const forecast = await salesIntelligenceService.runForecast(trainedModel.id, 30);
      console.log(`✅ Forecast generated! (ID: ${forecast.id})`);
      
      const preds = forecast.predictions as number[];
      console.log(`   First 5 predictions: ${preds.slice(0, 5).map(p => p.toFixed(2)).join(', ')}`);
      console.log(`   Last 5 predictions:  ${preds.slice(-5).map(p => p.toFixed(2)).join(', ')}`);

    } catch (e) {
      console.error(`❌ Failed to train or run forecast for ${type}:`, e);
    }
  }

  console.log(`\n================================`);
  console.log("🏁 ML Pipeline test completed.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
