-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REMINDER';

-- CreateTable
CREATE TABLE "payment_reminder" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "creditorMemberId" UUID NOT NULL,
    "debtorMemberId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "channel" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_reminder_groupId_creditorMemberId_debtorMemberId_cr_idx" ON "payment_reminder"("groupId", "creditorMemberId", "debtorMemberId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "payment_reminder" ADD CONSTRAINT "payment_reminder_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder" ADD CONSTRAINT "payment_reminder_creditorMemberId_fkey" FOREIGN KEY ("creditorMemberId") REFERENCES "group_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder" ADD CONSTRAINT "payment_reminder_debtorMemberId_fkey" FOREIGN KEY ("debtorMemberId") REFERENCES "group_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
