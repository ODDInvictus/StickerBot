/*
  Warnings:

  - Added the required column `city` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streetName` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streetNumber` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zipCode` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "streetName" TEXT NOT NULL,
ADD COLUMN     "streetNumber" TEXT NOT NULL,
ADD COLUMN     "zipCode" TEXT NOT NULL;
