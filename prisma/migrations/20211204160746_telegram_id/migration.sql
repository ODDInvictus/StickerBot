/*
  Warnings:

  - A unique constraint covering the columns `[telegramId]` on the table `Submitter` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `telegramId` on the `Submitter` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Submitter" DROP COLUMN "telegramId",
ADD COLUMN     "telegramId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Submitter_telegramId_key" ON "Submitter"("telegramId");
