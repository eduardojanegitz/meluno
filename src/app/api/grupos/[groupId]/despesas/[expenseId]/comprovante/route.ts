import { auth } from "@/server/auth/auth";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { deleteReceipt, getReceipt, MAX_RECEIPT_BYTES, putReceipt } from "@/server/services/receipts";
import { idSchema } from "@/schemas/common";

type Ctx = RouteContext<"/api/grupos/[groupId]/despesas/[expenseId]/comprovante">;

const STATUS: Record<string, number> = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, RATE_LIMITED: 429 };

/** Converte erros do serviço; nada de detalhe interno na resposta. */
async function handle(request: Request, ctx: Ctx, run: (viewer: { userId: string; name: string; email: string }, groupId: string, expenseId: string) => Promise<Response>) {
  const { groupId, expenseId } = await ctx.params;
  if (!idSchema.safeParse(groupId).success || !idSchema.safeParse(expenseId).success) return new Response("Não encontrado.", { status: 404 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Sessão expirada.", { status: 401 });
  try {
    return await run({ userId: session.user.id, name: session.user.name, email: session.user.email }, groupId, expenseId);
  } catch (error) {
    if (error instanceof AppError && STATUS[error.code]) return Response.json({ message: error.message }, { status: STATUS[error.code] });
    throw error;
  }
}

export function GET(request: Request, ctx: Ctx) {
  return handle(request, ctx, async (viewer, groupId, expenseId) => {
    const receipt = await getReceipt(viewer, groupId, expenseId);
    return new Response(new Uint8Array(receipt.data), {
      headers: {
        "Content-Type": receipt.contentType,
        "Content-Disposition": 'inline; filename="comprovante.jpg"',
        // Privado: só o navegador de quem pediu guarda, e por pouco tempo.
        "Cache-Control": "private, max-age=300",
        ETag: `"${receipt.createdAt.getTime()}"`,
      },
    });
  });
}

/** Corpo = bytes do JPEG, já comprimido no navegador. */
export function PUT(request: Request, ctx: Ctx) {
  return handle(request, ctx, async (viewer, groupId, expenseId) => {
    assertSameOrigin(request);
    await enforceRateLimit(`receipt:${viewer.userId}`, 60, 60 * 60);
    return Response.json(await putReceipt(viewer, groupId, expenseId, await readBody(request)));
  });
}

export function DELETE(request: Request, ctx: Ctx) {
  return handle(request, ctx, async (viewer, groupId, expenseId) => {
    assertSameOrigin(request);
    await deleteReceipt(viewer, groupId, expenseId);
    return new Response(null, { status: 204 });
  });
}

/**
 * Proteção contra CSRF: Route Handlers não têm a verificação de origem das Server Actions.
 * O cookie é SameSite=Lax (já barra PUT/DELETE de outro site), e conferimos a origem também.
 */
function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new AppError("FORBIDDEN", "Origem não permitida.");
}

/** Lê o corpo parando no limite (o Content-Length pode faltar ou mentir). */
async function readBody(request: Request): Promise<Uint8Array> {
  const tooBig = () => new AppError("VALIDATION", "A foto precisa ter até 1,5 MB.");
  if (Number(request.headers.get("content-length") ?? "0") > MAX_RECEIPT_BYTES) throw tooBig();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RECEIPT_BYTES) {
      await reader.cancel();
      throw tooBig();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
