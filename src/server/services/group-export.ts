import "server-only";
import type { Viewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { expenseCategories } from "@/lib/categories";
import { minorToCell, raw, toCsv, type Cell } from "@/lib/csv";
import { dbDateToCivil } from "@/schemas/common";
import { requireMember } from "./access";
import { formatRate } from "@/server/domain/fx";
import { currencyFractionDigits, minorToDecimalString } from "@/lib/format";

/** Valor em unidades mínimas → "1234,56" respeitando as casas da moeda (iene: "4139"). */
const minorDecimalCell = (minor: number, currency: string) => (currencyFractionDigits(currency) === 0 ? String(minor) : minorToDecimalString(minor, currency).replace(".", ","));

const statusText = { CONFIRMED: "confirmado", PENDING: "aguardando confirmação", REJECTED: "recusado" } as const;
const methodText = { EQUAL: "igual", EXACT: "valores", PERCENT: "porcentagem", SHARES: "partes", ITEMS: "por item" } as const;

/**
 * Planilha do grupo: uma linha por despesa e por acerto, com uma coluna por pessoa.
 * - despesa: a coluna da pessoa é a parte dela;
 * - acerto: positivo para quem pagou, negativo para quem recebeu.
 * Só para membros (ativos ou que já saíram, como no restante do app).
 */
export async function exportGroupCsv(viewer: Viewer, groupId: string) {
  const me = await db.$transaction((tx) => requireMember(tx, viewer, groupId));
  const members = await db.groupMember.findMany({ where: { groupId }, orderBy: { createdAt: "asc" }, select: { id: true, displayName: true } });
  const expenses = await db.expense.findMany({
    where: { groupId, deletedAt: null },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      date: true,
      description: true,
      category: true,
      amountMinor: true,
      splitMethod: true,
      notes: true,
      originalCurrency: true,
      originalAmountMinor: true,
      exchangeRateE10: true,
      payers: { select: { memberId: true, amountMinor: true } },
      splits: { select: { memberId: true, amountMinor: true } },
    },
  });
  const settlements = await db.settlement.findMany({
    where: { groupId, deletedAt: null },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: { date: true, amountMinor: true, status: true, note: true, fromMemberId: true, toMemberId: true },
  });

  const name = new Map(members.map((m) => [m.id, m.displayName]));
  const money = (v: number) => raw(minorToCell(v));
  const header: Cell[] = ["Data", "Tipo", "Descrição", "Categoria", "Divisão", `Valor (${me.group.currency})`, "Pago por", ...members.map((m) => `Parte de ${m.displayName}`), "Observações", "Moeda original", "Valor original", "Cotação"];

  type Row = { date: string; cells: Cell[] };
  const rows: Row[] = [];
  for (const e of expenses) {
    const share = new Map(e.splits.map((s) => [s.memberId, s.amountMinor]));
    const paidBy = e.payers.map((p) => (e.payers.length > 1 ? `${name.get(p.memberId)} (${minorToCell(p.amountMinor)})` : name.get(p.memberId))).join(", ");
    const date = dbDateToCivil(e.date);
    rows.push({
      date,
      cells: [date, "Despesa", e.description, expenseCategories[e.category].label, methodText[e.splitMethod], money(e.amountMinor), paidBy, ...members.map((m) => (share.has(m.id) ? money(share.get(m.id)!) : null)), e.notes,
        e.originalCurrency, e.originalCurrency && e.originalAmountMinor ? raw(minorDecimalCell(e.originalAmountMinor, e.originalCurrency)) : null, e.exchangeRateE10 !== null ? raw(formatRate(e.exchangeRateE10)) : null],
    });
  }
  for (const s of settlements) {
    const date = dbDateToCivil(s.date);
    rows.push({
      date,
      cells: [
        date,
        `Acerto (${statusText[s.status]})`,
        `${name.get(s.fromMemberId)} pagou ${name.get(s.toMemberId)}`,
        null,
        null,
        money(s.amountMinor),
        name.get(s.fromMemberId),
        ...members.map((m) => (m.id === s.fromMemberId ? money(s.amountMinor) : m.id === s.toMemberId ? money(-s.amountMinor) : null)),
        s.note,
        null,
        null,
        null,
      ],
    });
  }
  // Ordem estável por data: despesas antes dos acertos do mesmo dia.
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const slug = me.group.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "grupo";
  return { filename: `meluno-${slug}.csv`, csv: toCsv([header, ...rows.map((r) => r.cells)]) };
}
