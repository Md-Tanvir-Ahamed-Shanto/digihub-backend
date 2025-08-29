/*
  Warnings:

  - You are about to drop the column `isPartnerLastOffer` on the `leads` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "leads" DROP COLUMN "isPartnerLastOffer",
ADD COLUMN     "partnerOfferTime" INTEGER NOT NULL DEFAULT 0;
