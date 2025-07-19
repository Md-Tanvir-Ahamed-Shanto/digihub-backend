/*
  Warnings:

  - You are about to drop the column `accountHolderName` on the `withdrawals` table. All the data in the column will be lost.
  - You are about to drop the column `accountNumber` on the `withdrawals` table. All the data in the column will be lost.
  - You are about to drop the column `bankName` on the `withdrawals` table. All the data in the column will be lost.
  - You are about to drop the column `iban` on the `withdrawals` table. All the data in the column will be lost.
  - You are about to drop the column `paypalEmail` on the `withdrawals` table. All the data in the column will be lost.
  - You are about to drop the column `routingNumber` on the `withdrawals` table. All the data in the column will be lost.
  - You are about to drop the column `swiftCode` on the `withdrawals` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WithdrawalStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "WithdrawalStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "withdrawals" DROP COLUMN "accountHolderName",
DROP COLUMN "accountNumber",
DROP COLUMN "bankName",
DROP COLUMN "iban",
DROP COLUMN "paypalEmail",
DROP COLUMN "routingNumber",
DROP COLUMN "swiftCode";
