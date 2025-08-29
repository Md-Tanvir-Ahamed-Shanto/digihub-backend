-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'CLIENT_RESEND_OFFER';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "clientNotes" TEXT,
ADD COLUMN     "clientOffer" DECIMAL(65,30);
