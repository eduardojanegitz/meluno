/**
 * Gastos do grupo para os gráficos. Só despesas (acertos não são gasto).
 * Tudo em centavos inteiros e datas civis "AAAA-MM-DD".
 */
export type Period = "month" | "3m" | "year" | "all";

export type SpendingRow = {
  date: string;
  amountMinor: number;
  category: string;
  splits: { memberId: string; amountMinor: number }[];
  payers: { memberId: string; amountMinor: number }[];
};

export type Spending = {
  from: string | null;
  to: string;
  totalMinor: number;
  count: number;
  byCategory: { category: string; amountMinor: number }[];
  /** Meses do período, inclusive os sem gasto (no máximo os 12 últimos). */
  byMonth: { month: string; amountMinor: number }[];
  /** Parte (consumo) e quanto pagou, por pessoa. */
  byMember: { memberId: string; shareMinor: number; paidMinor: number }[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const monthOf = (date: string) => date.slice(0, 7);

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

/** Intervalo do período, terminando hoje. "all" começa no mês da primeira despesa. */
export function periodRange(period: Period, today: string, firstDate: string | null): { from: string | null; months: string[] } {
  const current = monthOf(today);
  const start =
    period === "month" ? current : period === "3m" ? addMonths(current, -2) : period === "year" ? `${today.slice(0, 4)}-01` : firstDate ? monthOf(firstDate) : current;
  const months: string[] = [];
  for (let m = start; m <= current; m = addMonths(m, 1)) months.push(m);
  return { from: period === "all" ? null : `${start}-01`, months: months.slice(-12) };
}

export function aggregateSpending(rows: SpendingRow[], period: Period, today: string): Spending {
  const firstDate = rows.reduce<string | null>((min, r) => (min === null || r.date < min ? r.date : min), null);
  const { from, months } = periodRange(period, today, firstDate);
  const inRange = rows.filter((r) => (from === null || r.date >= from) && r.date <= today);

  const cat = new Map<string, number>();
  const month = new Map(months.map((m) => [m, 0]));
  const member = new Map<string, { shareMinor: number; paidMinor: number }>();
  const touch = (id: string) => member.get(id) ?? member.set(id, { shareMinor: 0, paidMinor: 0 }).get(id)!;

  let totalMinor = 0;
  for (const r of inRange) {
    totalMinor += r.amountMinor;
    cat.set(r.category, (cat.get(r.category) ?? 0) + r.amountMinor);
    const m = monthOf(r.date);
    if (month.has(m)) month.set(m, month.get(m)! + r.amountMinor);
    for (const s of r.splits) touch(s.memberId).shareMinor += s.amountMinor;
    for (const p of r.payers) touch(p.memberId).paidMinor += p.amountMinor;
  }

  return {
    from,
    to: today,
    totalMinor,
    count: inRange.length,
    // Ranqueado do maior para o menor; empate por nome da categoria para ser estável.
    byCategory: [...cat].map(([category, amountMinor]) => ({ category, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor || a.category.localeCompare(b.category)),
    byMonth: [...month].map(([m, amountMinor]) => ({ month: m, amountMinor })),
    byMember: [...member].map(([memberId, v]) => ({ memberId, ...v })).sort((a, b) => b.shareMinor - a.shareMinor || a.memberId.localeCompare(b.memberId)),
  };
}
