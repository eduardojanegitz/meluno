import "server-only";
import { z } from "zod";
import type { Viewer } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { enforceRateLimit } from "@/server/rate-limit";
import { formatRate, rateFromNumber } from "@/server/domain/fx";
import { todayInBrazil } from "@/server/domain/recurrence";
import { civilDateSchema, currencySchema } from "@/schemas/common";

/** Moedas com cotação de referência do Banco Central Europeu (as que o app oferece). */
const ECB = new Set(["BRL", "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "MXN"]);

export const rateQuerySchema = z.object({ from: currencySchema, to: currencySchema, date: civilDateSchema });

type RateResult = { available: true; rate: string; date: string } | { available: false };

const cache = new Map<string, { at: number; value: RateResult }>();
const TTL = 12 * 60 * 60 * 1000;

/**
 * Cotação sugerida (referência do BCE via Frankfurter, gratuito e sem chave).
 * Só as moedas e a data saem do servidor. Fim de semana/feriado: vale o último dia útil.
 * Sempre é sugestão: a pessoa pode trocar pela cotação do cartão, da casa de câmbio etc.
 */
export async function suggestRate(viewer: Viewer, raw: z.input<typeof rateQuerySchema>): Promise<RateResult> {
  const { from, to, date } = rateQuerySchema.parse(raw);
  if (from === to || !ECB.has(from) || !ECB.has(to)) return { available: false };
  await enforceRateLimit(`fx:${viewer.userId}`, 60, 3600);

  const day = date > todayInBrazil() ? "latest" : date;
  const key = `${from}:${to}:${day}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/${day}?base=${from}&symbols=${to}`, { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = (await res.json()) as { date?: string; rates?: Record<string, number> };
    const n = body.rates?.[to];
    if (typeof n !== "number" || !body.date) throw new Error("resposta inesperada");
    const value: RateResult = { available: true, rate: formatRate(rateFromNumber(n)), date: body.date };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    logger.warn("fx.lookup_failed", { from, to, reason: error instanceof Error ? error.message.slice(0, 60) : "unknown" });
    return { available: false };
  }
}
