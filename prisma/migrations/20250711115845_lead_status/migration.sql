-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'REVIEWING';
ALTER TYPE "LeadStatus" ADD VALUE 'ASSIGNED_TO_PARTNER';
ALTER TYPE "LeadStatus" ADD VALUE 'PENDING_OFFER_REVIEW';
ALTER TYPE "LeadStatus" ADD VALUE 'OFFER_SENT_TO_CLIENT';
ALTER TYPE "LeadStatus" ADD VALUE 'OFFER_REJECTED_BY_CLIENT';
ALTER TYPE "LeadStatus" ADD VALUE 'ACCEPTED_AND_CONVERTED';
