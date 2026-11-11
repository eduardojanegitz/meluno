-- Serviço e taxas existem só (e sempre) na divisão por item.
ALTER TABLE "expense"
  ADD CONSTRAINT "expense_items_fields_coherence" CHECK (
    ("splitMethod" = 'ITEMS' AND "serviceBp" IS NOT NULL AND "feesMinor" IS NOT NULL)
    OR ("splitMethod" <> 'ITEMS' AND "serviceBp" IS NULL AND "feesMinor" IS NULL)
  );
