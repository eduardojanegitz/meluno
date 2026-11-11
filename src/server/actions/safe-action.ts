import "server-only";
import { unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import type { z } from "zod";
import { auth } from "@/server/auth/auth";
import type { Viewer } from "@/server/auth/session";
import { AppError, toActionError, type ActionResult } from "@/server/errors";
import { logger } from "@/server/logger";

/**
 * Envolve uma Server Action autenticada:
 *  1. valida a sessão no servidor (nunca confia no cliente);
 *  2. valida a entrada com Zod;
 *  3. executa o handler (que chama services com o Viewer);
 *  4. converte erros em ActionResult tipado, sem vazar detalhes internos.
 *
 * Server Actions do Next já verificam a origem da requisição (proteção CSRF).
 */
export function authedAction<S extends z.ZodType, T>(
  name: string,
  schema: S,
  handler: (input: z.output<S>, viewer: Viewer) => Promise<T>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session) throw new AppError("UNAUTHENTICATED");
      const input = schema.parse(raw);
      const viewer: Viewer = { userId: session.user.id, name: session.user.name, email: session.user.email };
      return { ok: true, data: await handler(input, viewer) };
    } catch (error) {
      // Repassa redirect()/notFound() e sinais internos do Next.
      unstable_rethrow(error);
      const result = toActionError(error);
      if (result.code === "INTERNAL") {
        logger.error(`${name}.failed`, { error: error instanceof Error ? error.name : "unknown" });
        if (process.env.NODE_ENV === "development") console.error(error);
      }
      return result;
    }
  };
}
