import { currencyFractionDigits } from "@/lib/format";

/**
 * Despesa em outra moeda. A conta do grupo continua na moeda do grupo; guardamos o
 * valor original e a cotação usada. A cotação é um inteiro: unidades da moeda do grupo
 * por 1 unidade da moeda original, × 10^10 ("5,5517" → 55_517_000_000n).
 * Nada passa por ponto flutuante.
 */
export const RATE_DECIMALS = 10;
const SCALE = 10n ** BigInt(RATE_DECIMALS);
/** Teto da cotação: 1 unidade estrangeira = no máximo 1.000.000 da moeda do grupo. */
const MAX_RATE = 1_000_000n * SCALE;

export class FxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FxError";
  }
}

/** "5,5517" | "5.5517" | "0,0379" → inteiro × 10^10. Recusa zero, negativos e mais de 10 casas. */
export function parseRate(text: string): bigint {
  const t = text.trim().replace(",", ".");
  const m = /^(\d{1,7})(?:\.(\d{1,10}))?$/.exec(t);
  if (!m) throw new FxError("Cotação inválida. Use algo como 5,4321.");
  const value = BigInt(m[1]!) * SCALE + BigInt((m[2] ?? "").padEnd(RATE_DECIMALS, "0"));
  if (value <= 0n) throw new FxError("A cotação precisa ser maior que zero.");
  if (value > MAX_RATE) throw new FxError("Cotação alta demais. Confira as moedas.");
  return value;
}

/** Inteiro × 10^10 → "5,5517" (sem zeros sobrando). */
export function formatRate(rate: bigint): string {
  const whole = rate / SCALE;
  const frac = (rate % SCALE).toString().padStart(RATE_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole},${frac}` : `${whole}`;
}

/**
 * Valor original (unidades mínimas da moeda original) → unidades mínimas da moeda do grupo,
 * arredondando meio para cima. Ex.: US$ 50,00 × 5,5517 = R$ 277,59 (277,585 → 277,59).
 */
export function convertMinor(originalMinor: number, from: string, to: string, rate: bigint): number {
  if (!Number.isSafeInteger(originalMinor) || originalMinor <= 0) throw new FxError("Valor original inválido.");
  const num = BigInt(originalMinor) * rate * 10n ** BigInt(currencyFractionDigits(to));
  const den = SCALE * 10n ** BigInt(currencyFractionDigits(from));
  const result = (num * 2n + den) / (2n * den);
  if (result <= 0n) throw new FxError("Com essa cotação o valor fica zero. Confira as moedas.");
  if (result > 1_000_000_000n) throw new FxError("O valor convertido passa do limite de uma despesa.");
  return Number(result);
}

/** Cotação a partir de um número com até 10 casas (resposta da API). */
export function rateFromNumber(n: number): bigint {
  if (!Number.isFinite(n) || n <= 0) throw new FxError("Cotação inválida.");
  return parseRate(n.toFixed(RATE_DECIMALS));
}
