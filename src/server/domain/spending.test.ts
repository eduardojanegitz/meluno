import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aggregateSpending, periodRange, type SpendingRow } from "./spending";

const row = (date: string, amountMinor: number, category: string, split: Record<string, number>, payer: string): SpendingRow => ({
  date,
  amountMinor,
  category,
  splits: Object.entries(split).map(([memberId, amountMinor]) => ({ memberId, amountMinor })),
  payers: [{ memberId: payer, amountMinor }],
});

const rows = [
  row("2026-01-15", 30000, "HOUSING", { a: 15000, b: 15000 }, "a"),
  row("2026-10-02", 9000, "FOOD", { a: 4500, b: 4500 }, "b"),
  row("2026-11-05", 12000, "GROCERIES", { a: 4000, b: 8000 }, "a"),
  row("2026-11-10", 3000, "FOOD", { b: 3000 }, "b"),
  row("2026-11-20", 99999, "FOOD", { a: 99999 }, "a"), // depois de hoje: fora
];
const today = "2026-11-11";

describe("gastos do grupo", () => {
  it("este mês: total, ranking de categorias e parte de cada um", () => {
    const s = aggregateSpending(rows, "month", today);
    expect(s).toMatchObject({ from: "2026-11-01", totalMinor: 15000, count: 2 });
    expect(s.byCategory).toEqual([
      { category: "GROCERIES", amountMinor: 12000 },
      { category: "FOOD", amountMinor: 3000 },
    ]);
    expect(s.byMember).toEqual([
      { memberId: "b", shareMinor: 11000, paidMinor: 3000 },
      { memberId: "a", shareMinor: 4000, paidMinor: 12000 },
    ]);
    expect(s.byMonth).toEqual([{ month: "2026-11", amountMinor: 15000 }]);
  });

  it("3 meses inclui os meses sem gasto; tudo começa na 1ª despesa e mostra no máximo 12 meses", () => {
    expect(aggregateSpending(rows, "3m", today).byMonth.map((m) => [m.month, m.amountMinor])).toEqual([
      ["2026-09", 0],
      ["2026-10", 9000],
      ["2026-11", 15000],
    ]);
    const all = aggregateSpending(rows, "all", today);
    expect(all).toMatchObject({ from: null, totalMinor: 54000, count: 4 });
    expect(all.byMonth).toHaveLength(11); // jan..nov
    expect(periodRange("all", "2027-06-01", "2025-01-10").months).toHaveLength(12);
    expect(periodRange("year", today, null).months[0]).toBe("2026-01");
  });

  it("propriedade: categorias, meses (quando cabem) e partes somam o total", () => {
    const arb = fc.array(
      fc.record({ day: fc.integer({ min: 0, max: 300 }), amount: fc.integer({ min: 1, max: 100000 }), cat: fc.constantFrom("FOOD", "TRAVEL", "OTHER"), aShare: fc.double({ min: 0, max: 1, noNaN: true }) }),
      { maxLength: 40 },
    );
    fc.assert(
      fc.property(arb, (items) => {
        const rs = items.map((i) => {
          const d = new Date(Date.UTC(2026, 0, 1 + i.day)).toISOString().slice(0, 10);
          const a = Math.round(i.amount * i.aShare);
          return row(d, i.amount, i.cat, { a, b: i.amount - a }, "a");
        });
        const s = aggregateSpending(rs, "year", "2026-12-31");
        const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0);
        expect(sum(s.byCategory.map((c) => c.amountMinor))).toBe(s.totalMinor);
        expect(sum(s.byMonth.map((c) => c.amountMinor))).toBe(s.totalMinor);
        expect(sum(s.byMember.map((m) => m.shareMinor))).toBe(s.totalMinor);
        expect(sum(s.byMember.map((m) => m.paidMinor))).toBe(s.totalMinor);
      }),
      { numRuns: 200 },
    );
  });
});
