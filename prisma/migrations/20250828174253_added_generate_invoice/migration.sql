-- CreateTable
CREATE TABLE "generated_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "gstAmount" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "gstEnabled" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "client" JSONB,
    "project" JSONB,
    "milestone" JSONB,
    "items" JSONB,
    "companyInfo" JSONB,

    CONSTRAINT "generated_invoices_pkey" PRIMARY KEY ("id")
);
