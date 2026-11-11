-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RecurrenceStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_PAUSED';

-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "recurringExpenseId" UUID;

-- CreateTable
CREATE TABLE "expense_receipt" (
    "expenseId" UUID NOT NULL,
    "contentType" VARCHAR(30) NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByMemberId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_receipt_pkey" PRIMARY KEY ("expenseId")
);

-- CreateTable
CREATE TABLE "recurring_expense" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "createdByMemberId" UUID NOT NULL,
    "description" VARCHAR(120) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "notes" VARCHAR(1000),
    "payers" JSONB NOT NULL,
    "split" JSONB NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "anchorDay" INTEGER NOT NULL,
    "nextDate" DATE NOT NULL,
    "status" "RecurrenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "recurring_expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_expense_status_nextDate_idx" ON "recurring_expense"("status", "nextDate");

-- CreateIndex
CREATE INDEX "recurring_expense_groupId_idx" ON "recurring_expense"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_recurringExpenseId_date_key" ON "expense"("recurringExpenseId", "date");

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "recurring_expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_receipt" ADD CONSTRAINT "expense_receipt_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_receipt" ADD CONSTRAINT "expense_receipt_uploadedByMemberId_fkey" FOREIGN KEY ("uploadedByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Restrições de integridade (além do que o Prisma expressa)
ALTER TABLE "expense_receipt" ADD CONSTRAINT "expense_receipt_size_range" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 1500000 AND octet_length("data") = "sizeBytes");
ALTER TABLE "expense_receipt" ADD CONSTRAINT "expense_receipt_jpeg_only" CHECK ("contentType" = 'image/jpeg');
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_amount_positive" CHECK ("amountMinor" > 0 AND "amountMinor" <= 1000000000);
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_anchor_day_range" CHECK ("anchorDay" BETWEEN 1 AND 31);
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_paused_reason" CHECK ("status" = 'PAUSED' OR "pausedReason" IS NULL);
