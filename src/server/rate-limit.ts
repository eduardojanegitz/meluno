import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

/**
 * Rate limit de janela fixa para ações sensíveis da aplicação, persistido na
 * mesma tabela do Better Auth (chaves com prefixo "app:"). Funciona entre
 * múltiplas instâncias do servidor. Desligado em testes.
 */
export async function enforceRateLimit(key: string, max: number, windowSeconds: number) {
  if (process.env.NODE_ENV === "test") return;
  const fullKey = `app:${key}`;
  const now = Date.now();
  const windowStart = BigInt(now - windowSeconds * 1000);

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit (id, key, count, "lastRequest")
    VALUES (${randomUUID()}, ${fullKey}, 1, ${BigInt(now)})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit."lastRequest" < ${windowStart} THEN 1 ELSE rate_limit.count + 1 END,
      "lastRequest" = CASE WHEN rate_limit."lastRequest" < ${windowStart} THEN ${BigInt(now)} ELSE rate_limit."lastRequest" END
    RETURNING count`;

  if ((rows[0]?.count ?? 0) > max) throw new AppError("RATE_LIMITED");
}
