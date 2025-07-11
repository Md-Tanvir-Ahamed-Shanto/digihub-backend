/*
  Warnings:

  - The values [ASSIGNED,QUOTED] on the enum `LeadStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING] on the enum `ProjectStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `adminId` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `partnerId` on the `leads` table. All the data in the column will be lost.
  - The `keyFeatures` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `adminId` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `gstAmount` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `gstEnabled` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `maintenanceMode` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `totalCost` on the `projects` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[projectId]` on the table `leads` will be added. If there are existing duplicate values, this will fail.
  - Made the column `phone` on table `leads` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `offerPrice` to the `projects` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LeadStatus_new" AS ENUM ('PENDING', 'OFFER_SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'ARCHIVED');
ALTER TABLE "leads" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
DROP TYPE "LeadStatus_old";
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('PENDING_CLIENT_ACCEPTANCE', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'REJECTED_BY_CLIENT');
ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING ("status"::text::"ProjectStatus_new");
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "ProjectStatus_old";
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'PENDING_CLIENT_ACCEPTANCE';
COMMIT;

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_adminId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_adminId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_leadId_fkey";

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "adminId",
DROP COLUMN "partnerId",
ADD COLUMN     "adminMargin" DECIMAL(65,30),
ADD COLUMN     "assignedPartnerId" TEXT,
ADD COLUMN     "includesGST" BOOLEAN DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "offerPrice" DECIMAL(65,30),
ADD COLUMN     "partnerCost" DECIMAL(65,30),
ADD COLUMN     "processedById" TEXT,
ADD COLUMN     "projectId" TEXT,
DROP COLUMN "keyFeatures",
ADD COLUMN     "keyFeatures" TEXT[],
ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "adminId",
DROP COLUMN "category",
DROP COLUMN "completedAt",
DROP COLUMN "endDate",
DROP COLUMN "gstAmount",
DROP COLUMN "gstEnabled",
DROP COLUMN "maintenanceMode",
DROP COLUMN "startDate",
DROP COLUMN "totalCost",
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "budget" TEXT,
ADD COLUMN     "createdByAdminId" TEXT,
ADD COLUMN     "includesGST" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offerPrice" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "projectCategory" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING_CLIENT_ACCEPTANCE',
ALTER COLUMN "timeline" DROP NOT NULL,
ALTER COLUMN "timeline" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "leads_projectId_key" ON "leads"("projectId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedPartnerId_fkey" FOREIGN KEY ("assignedPartnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
