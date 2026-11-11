import { apportion } from "./split";
import { compareIds } from "./money";

/**
 * Saldos derivados dos registros de origem — nada é armazenado.
 *
 *   saldo(m) = Σ pago por m − Σ devido por m + Σ acertos enviados − Σ acertos recebidos
 *
 * > 0: a receber · < 0: deve · = 0: quitado.
 * Invariante: a soma dos saldos de um grupo é sempre 0.
 */

export type LedgerExpense = {
  id: string;
  payers: { memberId: string; amountMinor: number }[];
  splits: { memberId: string; amountMinor: number }[];
};

/** Apenas acertos CONFIRMADOS e não excluídos entram no saldo. */
export type LedgerSettlement = { fromMemberId: string; toMemberId: string; amountMinor: number };

export type Ledger = { expenses: LedgerExpense[]; settlements: LedgerSettlement[] };

export function computeBalances(ledger: Ledger, memberIds: Iterable<string> = []): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (id: string, delta: number) => balances.set(id, (balances.get(id) ?? 0) + delta);
  for (const id of memberIds) balances.set(id, 0);

  for (const e of ledger.expenses) {
    for (const p of e.payers) add(p.memberId, p.amountMinor);
    for (const s of e.splits) add(s.memberId, -s.amountMinor);
  }
  for (const s of ledger.settlements) {
    add(s.fromMemberId, s.amountMinor);
    add(s.toMemberId, -s.amountMinor);
  }
  return balances;
}

export type Debt = { fromMemberId: string; toMemberId: string; amountMinor: number };

/**
 * Dívidas por par, sem simplificação ("quem deve para quem" literal).
 * Em cada despesa, a parte de cada participante é rateada entre os pagadores
 * proporcionalmente ao que cada um pagou (maior resto, semente = id da despesa).
 * Depois os pares são compensados entre si e com os acertos.
 * Preserva exatamente os saldos líquidos de computeBalances.
 */
export function pairwiseDebts(ledger: Ledger): Debt[] {
  // net[a][b] > 0 significa "a deve a b"
  const net = new Map<string, number>();
  const key = (a: string, b: string) => (compareIds(a, b) <= 0 ? `${a}|${b}` : `${b}|${a}`);
  const addDebt = (from: string, to: string, amount: number) => {
    if (from === to || amount === 0) return;
    const k = key(from, to);
    const sign = compareIds(from, to) <= 0 ? 1 : -1; // positivo: menor id deve ao maior
    net.set(k, (net.get(k) ?? 0) + sign * amount);
  };

  for (const e of ledger.expenses) {
    const weights = e.payers.map((p) => ({ memberId: p.memberId, weight: p.amountMinor }));
    for (const s of e.splits) {
      if (s.amountMinor === 0) continue;
      const portions = apportion(s.amountMinor, weights, `${e.id}:${s.memberId}`);
      for (const [payerId, amount] of portions) addDebt(s.memberId, payerId, amount);
    }
  }
  // Um acerto de A para B reduz o que A deve a B.
  for (const st of ledger.settlements) addDebt(st.toMemberId, st.fromMemberId, st.amountMinor);

  const debts: Debt[] = [];
  for (const [k, v] of net) {
    if (v === 0) continue;
    const [a, b] = k.split("|") as [string, string];
    debts.push(v > 0 ? { fromMemberId: a, toMemberId: b, amountMinor: v } : { fromMemberId: b, toMemberId: a, amountMinor: -v });
  }
  return debts.sort(
    (x, y) => y.amountMinor - x.amountMinor || compareIds(x.fromMemberId, y.fromMemberId) || compareIds(x.toMemberId, y.toMemberId),
  );
}
