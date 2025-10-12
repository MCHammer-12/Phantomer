/*
  Warnings:

  - The primary key for the `SeatMapping` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `adjacent_seats` on the `SeatMapping` table. All the data in the column will be lost.
  - Added the required column `screen_id` to the `SeatMapping` table without a default value. This is not possible if the table is not empty.
  - Made the column `section` on table `SeatMapping` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "SeatMapping_seat_no_key";

-- AlterTable
ALTER TABLE "SeatMapping" DROP CONSTRAINT "SeatMapping_pkey",
DROP COLUMN "adjacent_seats",
ADD COLUMN     "screen_id" INTEGER NOT NULL,
ALTER COLUMN "row" DROP NOT NULL,
ALTER COLUMN "section" SET NOT NULL,
ADD CONSTRAINT "SeatMapping_pkey" PRIMARY KEY ("screen_id", "seat_no");

-- CreateIndex
CREATE INDEX "SeatMapping_section_idx" ON "SeatMapping"("section");

-- CreateIndex
CREATE INDEX "SeatMapping_row_idx" ON "SeatMapping"("row");
