-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'PARTNER_OFFER_PROPOSED';
ALTER TYPE "LeadStatus" ADD VALUE 'OFFER_ACCEPTED_BY_CLIENT';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "partnerNotes" TEXT,
ADD COLUMN     "partnerOfferProposedAt" TIMESTAMP(3),
ADD COLUMN     "partnerProposedCost" DECIMAL(10,2);
