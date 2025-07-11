/*
  Warnings:

  - A unique constraint covering the columns `[verificationToken]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationExpires" TIMESTAMP(3),
ADD COLUMN     "verificationToken" TEXT,
ALTER COLUMN "isActive" SET DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "clients_verificationToken_key" ON "clients"("verificationToken");
