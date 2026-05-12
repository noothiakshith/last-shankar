-- AlterEnum
ALTER TYPE "UploadStatus" ADD VALUE 'PRODUCTS_SELECTED';

-- AlterTable
ALTER TABLE "UploadSession" ADD COLUMN     "selectedProducts" JSONB;
