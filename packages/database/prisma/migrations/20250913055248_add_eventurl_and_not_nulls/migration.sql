/*
  Warnings:

  - Added the required column `eventUrl` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Made the column `facilityId` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `performanceId` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `screenId` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `value` on table `Metadata` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "eventUrl" TEXT NOT NULL,
ALTER COLUMN "facilityId" SET NOT NULL,
ALTER COLUMN "performanceId" SET NOT NULL,
ALTER COLUMN "screenId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Metadata" ALTER COLUMN "value" SET NOT NULL;
