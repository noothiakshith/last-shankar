/*
  Warnings:

  - Added the required column `productId` to the `ForecastResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `ForecastResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `TrainedModel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `TrainedModel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ForecastResult" ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "region" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TrainedModel" ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "region" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "allocatedEmployeeId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_allocatedEmployeeId_fkey" FOREIGN KEY ("allocatedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
