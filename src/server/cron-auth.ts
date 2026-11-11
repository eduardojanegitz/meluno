import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Rotas /api/cron/*: exigem "Authorization: Bearer CRON_SECRET" (a Vercel envia sozinha).
 * Retorna uma Response de erro, ou null se autorizado.
 */
export function cronUnauthorized(request: Request): Response | null {
  const { CRON_SECRET } = env();
  if (!CRON_SECRET) return new Response("Agendamento desativado (CRON_SECRET vazio).", { status: 503 });
  const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return new Response("Não autorizado.", { status: 401 });
  return null;
}
