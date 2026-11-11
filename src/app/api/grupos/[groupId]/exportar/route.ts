import { auth } from "@/server/auth/auth";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { exportGroupCsv } from "@/server/services/group-export";
import { idSchema } from "@/schemas/common";

/** Planilha (CSV) do grupo. Só para quem participa; grupo alheio responde 404, como no resto do app. */
export async function GET(request: Request, ctx: RouteContext<"/api/grupos/[groupId]/exportar">) {
  const { groupId } = await ctx.params;
  if (!idSchema.safeParse(groupId).success) return new Response("Não encontrado.", { status: 404 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Sessão expirada.", { status: 401 });

  try {
    await enforceRateLimit(`group-export:${session.user.id}`, 20, 60 * 60);
    const { filename, csv } = await exportGroupCsv({ userId: session.user.id, name: session.user.name, email: session.user.email }, groupId);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return new Response("Não encontrado.", { status: 404 });
    if (error instanceof AppError && error.code === "RATE_LIMITED") return new Response(error.message, { status: 429 });
    throw error;
  }
}
