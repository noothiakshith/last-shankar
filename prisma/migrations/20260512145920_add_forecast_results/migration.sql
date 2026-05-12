-- AlterEnum
ALTER TYPE "UploadStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "UploadSession" ADD COLUMN     "forecastResults" JSONB;
