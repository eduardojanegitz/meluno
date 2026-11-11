import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { sendWeeklySummaries } from "@/server/services/weekly-summary";

export const maxDuration = 60;

/** Disparado pelo agendador (vercel.json: todo dia às 08h de Brasília; cada pessoa recebe no máximo 1 por semana). */
export async function GET(request: Request) {
  const { CRON_SECRET } = env();
  if (!CRON_SECRET) return new Response("Agendamento desativado (CRON_SECRET vazio).", { status: 503 });
  const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return new Response("Não autorizado.", { status: 401 });

  return Response.json(await sendWeeklySummaries());
}
