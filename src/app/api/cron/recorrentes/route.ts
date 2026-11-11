import { cronUnauthorized } from "@/server/cron-auth";
import { generateDueRecurring } from "@/server/services/recurring";

export const maxDuration = 60;

/** Disparado pelo agendador (vercel.json: todo dia às 06h de Brasília): lança as despesas recorrentes do dia. */
export async function GET(request: Request) {
  return cronUnauthorized(request) ?? Response.json(await generateDueRecurring());
}
