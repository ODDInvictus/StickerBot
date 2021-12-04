/*
  Warnings:

  - You are about to drop the column `locationId` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `photoId` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the `Location` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Photo` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `latitude` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `photoFileName` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_locationId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_photoId_fkey";

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "locationId",
DROP COLUMN "photoId",
ADD COLUMN     "latitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "longitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "photoFileName" TEXT NOT NULL;

-- DropTable
DROP TABLE "Location";

-- DropTable
DROP TABLE "Photo";
