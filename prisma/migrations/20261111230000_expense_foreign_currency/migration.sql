-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "exchangeRateE10" BIGINT,
ADD COLUMN     "originalAmountMinor" INTEGER,
ADD COLUMN     "originalCurrency" CHAR(3);


-- Os três campos andam juntos, a moeda original é outra e os valores são positivos.
ALTER TABLE "expense" ADD CONSTRAINT "expense_foreign_currency_coherence" CHECK (
  ("originalCurrency" IS NULL AND "originalAmountMinor" IS NULL AND "exchangeRateE10" IS NULL)
  OR ("originalCurrency" IS NOT NULL AND "originalAmountMinor" > 0 AND "originalAmountMinor" <= 1000000000
      AND "exchangeRateE10" > 0 AND "originalCurrency" <> "currency")
);
