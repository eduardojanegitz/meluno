"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ReceiptText, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ExpenseCategory } from "@/lib/categories";
import { civilToLocalDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "./expense-row";
import { CivilDate } from "@/components/app/relative-time";

type Item = {
  id: string;
  description: string;
  amountMinor: number;
  date: string;
  category: ExpenseCategory;
  paidByLabel: string;
  viewerImpactMinor: number;
};

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const monthLabel = (ym: string) => {
  const text = monthFmt.format(civilToLocalDate(`${ym}-01`));
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
};

/** Lista de despesas agrupada por mês, com busca quando a lista cresce. */
export function ExpenseList({ groupId, currency, archived, expenses }: { groupId: string; currency: string; archived: boolean; expenses: Item[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");

  const months = useMemo(() => {
    const filtered = normalized
      ? expenses.filter((e) => e.description.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(normalized))
      : expenses;
    const map = new Map<string, Item[]>();
    for (const e of filtered) {
      const key = e.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map];
  }, [expenses, normalized]);

  if (expenses.length === 0) {
    return (
      <div className="bg-card rounded-3xl border">
        <EmptyState
          icon={ReceiptText}
          title="Nenhum gasto ainda"
          mood="happy"
          description="Anote o que alguém pagou e deixa a matemática comigo."
          action={
            !archived ? (
              <Button asChild variant="mint">
                <Link href={`/grupos/${groupId}/despesas/nova`}>
                  <Plus /> Adicionar despesa
                </Link>
              </Button>
            ) : null
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {expenses.length > 8 ? (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" aria-hidden="true" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar despesa" aria-label="Buscar despesa" className="pl-10" />
        </div>
      ) : null}
      {months.length === 0 ? <p className="text-muted-foreground py-8 text-center text-sm">Nenhuma despesa encontrada para “{query}”.</p> : null}
      {months.map(([month, items]) => (
        <section key={month}>
          <h3 className="text-muted-foreground mb-1 text-[13px] font-semibold">{monthLabel(month)}</h3>
          <ul className="bg-card divide-y rounded-2xl border shadow-card px-4">
            <AnimatePresence initial={false}>
              {items.map((e) => (
                <motion.li key={e.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Link href={`/grupos/${groupId}/despesas/${e.id}`} className="hover:bg-muted/50 focus-visible:ring-ring -mx-4 block rounded-xl px-4 outline-none focus-visible:ring-2">
                    <ExpenseRow
                      description={e.description}
                      category={e.category}
                      totalMinor={e.amountMinor}
                      paidByLabel={e.paidByLabel}
                      userImpactMinor={e.viewerImpactMinor}
                      currency={currency}
                      dateLabel={<CivilDate value={e.date} />}
                    />
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
