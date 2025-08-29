-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "clientOfferTime" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPartnerLastOffer" BOOLEAN DEFAULT false;
