import "server-only";
import { env } from "@/lib/env";
import { routeOf, scrub } from "@/lib/scrub";
import { logger } from "@/server/logger";

export type ErrorReport = {
  source: "server" | "client";
  name: string;
  message?: string;
  digest?: string;
  route?: string;
  method?: string;
  kind?: string;
};

/**
 * Registro de erros sem dados pessoais (ADR 0012):
 * - sempre no log estruturado (a Vercel guarda e permite alertas);
 * - opcionalmente num webhook (ERROR_WEBHOOK_URL: Slack, Discord, um coletor próprio…).
 * Nada de corpo da requisição, cookies, cabeçalhos, e-mail ou id de usuário.
 */
export async function reportError(r: ErrorReport) {
  const fields = {
    source: r.source,
    name: scrub(r.name, 60),
    message: r.message ? scrub(r.message) : undefined,
    digest: r.digest?.slice(0, 40),
    route: r.route ? routeOf(r.route) : undefined,
    method: r.method?.slice(0, 10),
    kind: r.kind?.slice(0, 30),
  };
  logger.error("app.error", fields);

  const { ERROR_WEBHOOK_URL, NODE_ENV } = env();
  if (!ERROR_WEBHOOK_URL || NODE_ENV === "test") return;
  try {
    await fetch(ERROR_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // "content" (Discord) e "text" (Slack) com o mesmo resumo; o JSON completo vai em "error".
      body: JSON.stringify({ text: summary(fields), content: summary(fields), error: fields }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    logger.warn("app.error_webhook_failed");
  }
}

function summary(f: Record<string, string | undefined>) {
  return `Meluno · erro ${f.source}: ${f.name}${f.message ? ` — ${f.message}` : ""} (${f.method ?? ""} ${f.route ?? "?"}${f.digest ? `, digest ${f.digest}` : ""})`;
}
