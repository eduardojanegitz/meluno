/**
 * Valores monetários do domínio: inteiros em unidades mínimas (centavos).
 * Nenhuma função deste módulo usa ponto flutuante.
 */

/** Teto por valor individual (R$ 10.000.000,00). Espelhado em CHECK no banco. */
export const MAX_AMOUNT_MINOR = 1_000_000_000;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertMinor(value: number, label = "valor"): void {
  if (!Number.isSafeInteger(value)) throw new MoneyError(`${label} precisa ser um inteiro em centavos`);
}

export function assertPositiveAmount(value: number, label = "valor"): void {
  assertMinor(value, label);
  if (value <= 0) throw new MoneyError(`${label} precisa ser maior que zero`);
  if (value > MAX_AMOUNT_MINOR) throw new MoneyError(`${label} acima do limite permitido`);
}

export function sumMinor(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) {
    assertMinor(v);
    total += v;
  }
  assertMinor(total, "soma");
  return total;
}

/** Hash FNV-1a 32 bits — usado só para desempates determinísticos. */
export function stableHash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Comparador estável de strings (independente de locale). */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
