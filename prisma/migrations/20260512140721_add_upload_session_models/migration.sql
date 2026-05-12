-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('STAGED', 'MAPPING_CONFIRMED', 'IMPORTED', 'FAILED');

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "UploadStatus" NOT NULL DEFAULT 'STAGED',
    "columnMapping" JSONB,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagedSaleRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,

    CONSTRAINT "StagedSaleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StagedSaleRecord_sessionId_idx" ON "StagedSaleRecord"("sessionId");

-- AddForeignKey
ALTER TABLE "StagedSaleRecord" ADD CONSTRAINT "StagedSaleRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
