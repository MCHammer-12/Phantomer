/*
  Warnings:

  - You are about to drop the column `sourceUrl` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the `metadata` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "sourceUrl",
ADD COLUMN     "facilityId" INTEGER DEFAULT 487,
ADD COLUMN     "groupCount" INTEGER DEFAULT 0,
ADD COLUMN     "performanceId" TEXT,
ADD COLUMN     "screenId" INTEGER;

-- DropTable
DROP TABLE "metadata";

-- CreateTable
CREATE TABLE "Metadata" (
    "key" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "Metadata_pkey" PRIMARY KEY ("key")
);
