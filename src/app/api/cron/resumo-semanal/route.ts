import { cronUnauthorized } from "@/server/cron-auth";
import { sendWeeklySummaries } from "@/server/services/weekly-summary";

export const maxDuration = 60;

/** Disparado pelo agendador (vercel.json: todo dia às 08h de Brasília; cada pessoa recebe no máximo 1 por semana). */
export async function GET(request: Request) {
  return cronUnauthorized(request) ?? Response.json(await sendWeeklySummaries());
}
