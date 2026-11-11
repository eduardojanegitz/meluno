import { z } from "zod";
import { enforceRateLimit } from "@/server/rate-limit";
import { reportError } from "@/server/observability";
import { AppError } from "@/server/errors";

const schema = z.object({
  name: z.string().max(100),
  message: z.string().max(1000).optional(),
  digest: z.string().max(100).optional(),
  path: z.string().max(500),
});

/** Erros do navegador (error.tsx). Sem login exigido; limitado por IP. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return new Response(null, { status: 403 });
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0]!.trim().slice(0, 64);
  try {
    await enforceRateLimit(`client-error:${ip}`, 30, 10 * 60);
  } catch (error) {
    if (error instanceof AppError) return new Response(null, { status: 429 });
    throw error;
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  await reportError({ source: "client", name: parsed.data.name, message: parsed.data.message, digest: parsed.data.digest, route: parsed.data.path });
  return new Response(null, { status: 204 });
}
