-- AlterTable
ALTER TABLE "TrainedModel" ADD COLUMN     "lastRetrainedAt" TIMESTAMP(3),
ADD COLUMN     "retrainThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "PredictionLog" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "predictionDate" TIMESTAMP(3) NOT NULL,
    "predictedQty" DOUBLE PRECISION NOT NULL,
    "actualQty" DOUBLE PRECISION,
    "error" DOUBLE PRECISION,
    "absError" DOUBLE PRECISION,
    "squaredError" DOUBLE PRECISION,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualRecordedAt" TIMESTAMP(3),

    CONSTRAINT "PredictionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PredictionLog_modelId_idx" ON "PredictionLog"("modelId");

-- CreateIndex
CREATE INDEX "PredictionLog_forecastId_idx" ON "PredictionLog"("forecastId");

-- CreateIndex
CREATE INDEX "PredictionLog_productId_region_predictionDate_idx" ON "PredictionLog"("productId", "region", "predictionDate");
