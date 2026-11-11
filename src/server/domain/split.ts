import { assertMinor, assertPositiveAmount, compareIds, stableHash, sumMinor } from "./money";

/**
 * Motor de divisão de despesas.
 *
 * Todos os métodos produzem valores inteiros em centavos cuja soma é
 * exatamente o total. Igual, percentual e por partes usam o método do maior
 * resto (Hamilton) sobre pesos inteiros:
 *
 *   base_i  = floor(total × peso_i / Σpesos)
 *   resto   = total − Σbase_i            (sempre < número de participantes)
 *   os `resto` centavos vão, um a um, para quem teve maior fração descartada.
 *
 * Empates de fração são resolvidos por uma ordem derivada de `seed`
 * (o id da despesa): é determinística — recalcular sempre dá o mesmo
 * resultado — mas varia entre despesas, para que a mesma pessoa não absorva
 * sempre o centavo extra (ADR 0001 §5).
 */

export type SplitMethod = "EQUAL" | "EXACT" | "PERCENT" | "SHARES";

/** Escalas dos valores informados pelo usuário. */
export const PERCENT_SCALE = 10_000; // 100,00% em pontos-base (1% = 100)
export const SHARES_SCALE = 100; // 1 parte = 100 (permite 1,5 parte = 150)
export const MAX_SHARES_VALUE = 1_000 * SHARES_SCALE;
export const MAX_PARTICIPANTS = 100;

export type SplitEntry = { memberId: string; value?: number };

export type SplitRequest =
  | { method: "EQUAL"; entries: { memberId: string }[] }
  /** value = centavos */
  | { method: "EXACT"; entries: { memberId: string; value: number }[] }
  /** value = pontos-base; a soma precisa ser 10.000 */
  | { method: "PERCENT"; entries: { memberId: string; value: number }[] }
  /** value = partes × 100 */
  | { method: "SHARES"; entries: { memberId: string; value: number }[] };

export type SplitShare = {
  memberId: string;
  amountMinor: number;
  /** Valor informado (persistido em ExpenseSplit.inputValue); null em EQUAL. */
  inputValue: number | null;
};

export type SplitErrorCode =
  | "NO_PARTICIPANTS"
  | "TOO_MANY_PARTICIPANTS"
  | "DUPLICATE_MEMBER"
  | "INVALID_VALUE"
  | "EXACT_SUM_MISMATCH"
  | "PERCENT_SUM_MISMATCH"
  | "SHARES_ALL_ZERO";

export class SplitError extends Error {
  readonly code: SplitErrorCode;
  /** Para *_SUM_MISMATCH: quanto falta (>0) ou sobra (<0) na unidade do método. */
  readonly difference?: number;

  constructor(code: SplitErrorCode, message: string, difference?: number) {
    super(message);
    this.name = "SplitError";
    this.code = code;
    this.difference = difference;
  }
}

function assertEntries(entries: { memberId: string }[]) {
  if (entries.length === 0) throw new SplitError("NO_PARTICIPANTS", "Escolha pelo menos uma pessoa.");
  if (entries.length > MAX_PARTICIPANTS) throw new SplitError("TOO_MANY_PARTICIPANTS", "Participantes demais.");
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.memberId)) throw new SplitError("DUPLICATE_MEMBER", "Pessoa repetida na divisão.");
    seen.add(e.memberId);
  }
}

/**
 * Distribui `total` proporcionalmente a pesos inteiros não negativos
 * (Σpesos > 0). Exportado para reuso (ex.: rateio entre pagadores).
 */
export function apportion(total: number, weights: { memberId: string; weight: number }[], seed: string): Map<string, number> {
  assertMinor(total, "total");
  if (total < 0) throw new SplitError("INVALID_VALUE", "Total negativo.");
  const sumW = weights.reduce((acc, w) => acc + BigInt(w.weight), 0n);
  if (sumW <= 0n) throw new SplitError("SHARES_ALL_ZERO", "Pelo menos uma pessoa precisa ter peso maior que zero.");

  const T = BigInt(total);
  const rows = weights.map((w) => {
    const product = T * BigInt(w.weight);
    return {
      memberId: w.memberId,
      base: Number(product / sumW),
      remainder: product % sumW, // fração descartada, na escala de sumW
      tie: stableHash(`${seed}:${w.memberId}`),
    };
  });

  let leftover = total - rows.reduce((acc, r) => acc + r.base, 0);
  const order = [...rows].sort(
    (a, b) =>
      (a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1) ||
      a.tie - b.tie ||
      compareIds(a.memberId, b.memberId),
  );

  const result = new Map(rows.map((r) => [r.memberId, r.base]));
  for (const r of order) {
    if (leftover === 0) break;
    // Só recebe centavo extra quem tem peso > 0.
    if (weights.find((w) => w.memberId === r.memberId)!.weight === 0) continue;
    result.set(r.memberId, result.get(r.memberId)! + 1);
    leftover--;
  }
  return result;
}

export function computeSplit(totalMinor: number, request: SplitRequest, seed: string): SplitShare[] {
  assertPositiveAmount(totalMinor, "total");
  assertEntries(request.entries);

  switch (request.method) {
    case "EQUAL": {
      const amounts = apportion(totalMinor, request.entries.map((e) => ({ memberId: e.memberId, weight: 1 })), seed);
      return request.entries.map((e) => ({ memberId: e.memberId, amountMinor: amounts.get(e.memberId)!, inputValue: null }));
    }

    case "EXACT": {
      for (const e of request.entries) {
        if (!Number.isSafeInteger(e.value) || e.value < 0) throw new SplitError("INVALID_VALUE", "Valores precisam ser positivos.");
      }
      const sum = sumMinor(request.entries.map((e) => e.value));
      if (sum !== totalMinor) {
        throw new SplitError("EXACT_SUM_MISMATCH", "A soma dos valores precisa ser igual ao total.", totalMinor - sum);
      }
      return request.entries.map((e) => ({ memberId: e.memberId, amountMinor: e.value, inputValue: e.value }));
    }

    case "PERCENT": {
      for (const e of request.entries) {
        if (!Number.isSafeInteger(e.value) || e.value < 0 || e.value > PERCENT_SCALE) {
          throw new SplitError("INVALID_VALUE", "Porcentagens precisam estar entre 0% e 100%.");
        }
      }
      const sum = request.entries.reduce((acc, e) => acc + e.value, 0);
      if (sum !== PERCENT_SCALE) {
        throw new SplitError("PERCENT_SUM_MISMATCH", "As porcentagens precisam somar 100%.", PERCENT_SCALE - sum);
      }
      const amounts = apportion(totalMinor, request.entries.map((e) => ({ memberId: e.memberId, weight: e.value })), seed);
      return request.entries.map((e) => ({ memberId: e.memberId, amountMinor: amounts.get(e.memberId)!, inputValue: e.value }));
    }

    case "SHARES": {
      for (const e of request.entries) {
        if (!Number.isSafeInteger(e.value) || e.value < 0 || e.value > MAX_SHARES_VALUE) {
          throw new SplitError("INVALID_VALUE", "Partes inválidas.");
        }
      }
      const amounts = apportion(totalMinor, request.entries.map((e) => ({ memberId: e.memberId, weight: e.value })), seed);
      return request.entries.map((e) => ({ memberId: e.memberId, amountMinor: amounts.get(e.memberId)!, inputValue: e.value }));
    }
  }
}

export type PayerEntry = { memberId: string; amountMinor: number };

export type PayerErrorCode = "NO_PAYERS" | "DUPLICATE_PAYER" | "INVALID_PAYER_AMOUNT" | "PAYERS_SUM_MISMATCH";

export class PayerError extends Error {
  readonly code: PayerErrorCode;
  readonly difference?: number;
  constructor(code: PayerErrorCode, message: string, difference?: number) {
    super(message);
    this.name = "PayerError";
    this.code = code;
    this.difference = difference;
  }
}

/** Valida pagadores: valores > 0, sem repetição, soma = total. */
export function validatePayers(totalMinor: number, payers: PayerEntry[]): PayerEntry[] {
  assertPositiveAmount(totalMinor, "total");
  if (payers.length === 0) throw new PayerError("NO_PAYERS", "Informe quem pagou.");
  const seen = new Set<string>();
  for (const p of payers) {
    if (seen.has(p.memberId)) throw new PayerError("DUPLICATE_PAYER", "Pagador repetido.");
    seen.add(p.memberId);
    if (!Number.isSafeInteger(p.amountMinor) || p.amountMinor <= 0) {
      throw new PayerError("INVALID_PAYER_AMOUNT", "Cada pagador precisa ter valor maior que zero.");
    }
  }
  const sum = sumMinor(payers.map((p) => p.amountMinor));
  if (sum !== totalMinor) throw new PayerError("PAYERS_SUM_MISMATCH", "A soma paga precisa ser igual ao total.", totalMinor - sum);
  return payers;
}
