-- Corrige a restrição anterior: em SQL, "NULL > 0" é desconhecido e o CHECK deixava passar
-- linhas com só um dos três campos preenchidos. Agora cada campo é exigido explicitamente.
ALTER TABLE "expense" DROP CONSTRAINT "expense_foreign_currency_coherence";
ALTER TABLE "expense" ADD CONSTRAINT "expense_foreign_currency_coherence" CHECK (
  ("originalCurrency" IS NULL AND "originalAmountMinor" IS NULL AND "exchangeRateE10" IS NULL)
  OR (
    "originalCurrency" IS NOT NULL AND "originalAmountMinor" IS NOT NULL AND "exchangeRateE10" IS NOT NULL
    AND "originalAmountMinor" > 0 AND "originalAmountMinor" <= 1000000000
    AND "exchangeRateE10" > 0 AND "originalCurrency" <> "currency"
  )
);
