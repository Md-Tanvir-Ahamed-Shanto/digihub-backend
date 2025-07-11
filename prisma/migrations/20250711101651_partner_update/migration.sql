/*
  Warnings:

  - A unique constraint covering the columns `[verificationToken]` on the table `partners` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `projectTitle` to the `leads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "keyFeatures" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "projectTitle" TEXT NOT NULL,
ADD COLUMN     "timeline" TEXT;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "verificationExpires" TIMESTAMP(3),
ADD COLUMN     "verificationToken" TEXT,
ALTER COLUMN "isActive" SET DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "partners_verificationToken_key" ON "partners"("verificationToken");
