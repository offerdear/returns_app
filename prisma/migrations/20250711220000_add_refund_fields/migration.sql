-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN "refunded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReturnRequest" ADD COLUMN "refundAmount" REAL;

ALTER TABLE "Receipt" ADD COLUMN "refunded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Receipt" ADD COLUMN "refundAmount" REAL;
