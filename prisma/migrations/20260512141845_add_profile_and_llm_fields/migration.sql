-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UploadStatus" ADD VALUE 'ANALYZING';
ALTER TYPE "UploadStatus" ADD VALUE 'ANALYZED';

-- AlterTable
ALTER TABLE "UploadSession" ADD COLUMN     "llmRecommendations" JSONB,
ADD COLUMN     "llmSummary" TEXT,
ADD COLUMN     "profileData" JSONB;
