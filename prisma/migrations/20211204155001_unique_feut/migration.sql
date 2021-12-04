/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `AspirantSubmitter` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AspirantSubmitter_name_key" ON "AspirantSubmitter"("name");
