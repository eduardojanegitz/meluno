import { auth } from "@/server/auth/auth";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { enforceRateLimit } from "@/server/rate-limit";
import { exportMyData } from "@/server/services/data-export";

/**
 * Baixa os dados pessoais em JSON (LGPD, portabilidade). Só a própria pessoa, com sessão válida.
 * GET de outro site até dispara o download, mas não consegue ler a resposta (mesma origem).
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Sessão expirada.", { status: 401 });

  try {
    await enforceRateLimit(`export:${session.user.id}`, 5, 60 * 60);
  } catch (error) {
    if (error instanceof AppError && error.code === "RATE_LIMITED") return new Response("Muitas exportações seguidas. Tente daqui a uma hora.", { status: 429 });
    throw error;
  }

  const data = await exportMyData({ userId: session.user.id, name: session.user.name, email: session.user.email });
  logger.info("account.exported");
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meluno-meus-dados-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
