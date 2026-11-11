import { compareIds } from "./money";
import type { Debt } from "./balance";

/**
 * Simplificação de dívidas: transforma saldos líquidos em transferências.
 *
 * Garantias (testadas por propriedades):
 *  - aplicar as transferências zera todos os saldos (preserva o líquido de cada um);
 *  - nenhuma transferência é negativa, nula ou de alguém para si mesmo;
 *  - no máximo (n − 1) transferências, n = pessoas com saldo ≠ 0;
 *  - resultado determinístico para a mesma entrada (independe da ordem).
 *
 * Mínimo de transferências:
 *  Encontrar o mínimo é NP-difícil — equivale a particionar os saldos no maior
 *  número de subconjuntos de soma zero (cada subconjunto de k pessoas exige
 *  k − 1 transferências). Até EXACT_LIMIT pessoas com saldo ≠ 0 usamos
 *  programação dinâmica sobre subconjuntos (O(2^n · n)), que GARANTE o mínimo.
 *  Acima disso usamos o guloso (maior devedor paga ao maior credor), com um
 *  pré-passe que casa pares de valores idênticos. O guloso NÃO garante o
 *  mínimo, mas nunca passa de n − 1 transferências.
 */

export const EXACT_LIMIT = 12;

type Entry = { memberId: string; amount: number };

function nonZeroSorted(balances: Map<string, number>): Entry[] {
  return [...balances]
    .filter(([, v]) => v !== 0)
    .map(([memberId, amount]) => ({ memberId, amount }))
    .sort((a, b) => compareIds(a.memberId, b.memberId));
}

/** Guloso com pré-passe de pares exatos. Entrada deve somar zero. Exportado para testes. */
export function greedy(entries: Entry[]): Debt[] {
  const creditors = entries.filter((e) => e.amount > 0).map((e) => ({ ...e }));
  const debtors = entries.filter((e) => e.amount < 0).map((e) => ({ ...e, amount: -e.amount }));
  const out: Debt[] = [];

  // Pré-passe: credor e devedor com o mesmo valor resolvem-se em 1 transferência.
  for (const d of debtors) {
    const match = creditors.find((c) => c.amount > 0 && c.amount === d.amount);
    if (match && d.amount > 0) {
      out.push({ fromMemberId: d.memberId, toMemberId: match.memberId, amountMinor: d.amount });
      match.amount = 0;
      d.amount = 0;
    }
  }

  const byLargest = (a: Entry, b: Entry) => b.amount - a.amount || compareIds(a.memberId, b.memberId);
  for (;;) {
    const d = debtors.filter((x) => x.amount > 0).sort(byLargest)[0];
    const c = creditors.filter((x) => x.amount > 0).sort(byLargest)[0];
    if (!d || !c) break;
    const amount = Math.min(d.amount, c.amount);
    out.push({ fromMemberId: d.memberId, toMemberId: c.memberId, amountMinor: amount });
    d.amount -= amount;
    c.amount -= amount;
  }
  return out;
}

/** Partição ótima em subconjuntos de soma zero (n ≤ EXACT_LIMIT). */
function exact(entries: Entry[]): Debt[] {
  const n = entries.length;
  const full = (1 << n) - 1;
  const sum = new Array<number>(1 << n).fill(0);
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    sum[mask] = sum[mask ^ low]! + entries[31 - Math.clz32(low)]!.amount;
  }

  // dp[mask] = maior número de subconjuntos de soma zero em que `mask` se particiona
  // ao remover elementos um a um (contando quando o prefixo restante soma zero).
  const dp = new Int8Array(1 << n);
  for (let mask = 1; mask <= full; mask++) {
    let best = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) best = Math.max(best, dp[mask ^ (1 << i)]!);
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // Reconstrução determinística: remove sempre o menor índice que mantém o ótimo.
  const groups: Entry[][] = [];
  let current: Entry[] = [];
  let mask = full;
  while (mask) {
    const target = dp[mask]! - (sum[mask] === 0 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const bit = 1 << i;
      if (mask & bit && dp[mask ^ bit] === target) {
        current.push(entries[i]!);
        mask ^= bit;
        break;
      }
    }
    if (mask === 0 || sum[mask] === 0) {
      groups.push(current);
      current = [];
    }
  }

  return groups.flatMap(greedy);
}

export function simplifyDebts(balances: Map<string, number>): Debt[] {
  const entries = nonZeroSorted(balances);
  const total = entries.reduce((acc, e) => acc + e.amount, 0);
  if (total !== 0) throw new Error(`Saldos inconsistentes: soma ${total} ≠ 0`);
  if (entries.length === 0) return [];
  const debts = entries.length <= EXACT_LIMIT ? exact(entries) : greedy(entries);
  return debts.sort(
    (x, y) => y.amountMinor - x.amountMinor || compareIds(x.fromMemberId, y.fromMemberId) || compareIds(x.toMemberId, y.toMemberId),
  );
}
