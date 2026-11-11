-- AlterEnum
ALTER TYPE "SplitMethod" ADD VALUE 'ITEMS';

-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "feesMinor" INTEGER,
ADD COLUMN     "serviceBp" INTEGER;

-- CreateTable
CREATE TABLE "expense_item" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(80) NOT NULL,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "expense_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_item_member" (
    "itemId" UUID NOT NULL,
    "memberId" UUID NOT NULL,

    CONSTRAINT "expense_item_member_pkey" PRIMARY KEY ("itemId","memberId")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_item_expenseId_position_key" ON "expense_item"("expenseId", "position");

-- CreateIndex
CREATE INDEX "expense_item_member_memberId_idx" ON "expense_item_member"("memberId");

-- AddForeignKey
ALTER TABLE "expense_item" ADD CONSTRAINT "expense_item_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_item_member" ADD CONSTRAINT "expense_item_member_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "expense_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_item_member" ADD CONSTRAINT "expense_item_member_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restrições financeiras (mesmas regras do domínio, garantidas também no banco).
ALTER TABLE "expense_item"
  ADD CONSTRAINT "expense_item_amount_positive" CHECK ("amountMinor" > 0 AND "amountMinor" <= 1000000000),
  ADD CONSTRAINT "expense_item_position_range" CHECK ("position" >= 0 AND "position" < 60);

-- Serviço entre 0% e 30%; taxas não negativas; só existem na divisão por item.
-- (A comparação com o literal do enum fica em migration separada: um valor de
-- enum recém-adicionado não pode ser usado na mesma transação.)
ALTER TABLE "expense"
  ADD CONSTRAINT "expense_service_bp_range" CHECK ("serviceBp" IS NULL OR ("serviceBp" >= 0 AND "serviceBp" <= 3000)),
  ADD CONSTRAINT "expense_fees_range" CHECK ("feesMinor" IS NULL OR ("feesMinor" >= 0 AND "feesMinor" <= 1000000000));
