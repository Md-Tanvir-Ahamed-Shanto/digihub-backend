-- CreateTable
CREATE TABLE "payment_details" (
    "id" TEXT NOT NULL,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNo" TEXT NOT NULL,
    "routingNo" TEXT,
    "paypalEmail" TEXT,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_details_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_details" ADD CONSTRAINT "payment_details_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
