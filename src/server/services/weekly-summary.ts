import "server-only";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/mailer";
import { weeklySummaryMessage } from "@/server/email/templates";
import { logger } from "@/server/logger";
import { getDashboard } from "./queries";

const DAY = 24 * 60 * 60 * 1000;
// Cabe em ~60 s. O agendador roda uma vez por dia (limite do plano Hobby da Vercel) e cada
// pessoa só recebe se o último resumo tiver mais de 6 dias: o envio é semanal por pessoa e
// quem não coube num dia vai no seguinte, sem duplicar.
const BATCH = 200;

/**
 * Resumo semanal por e-mail (opt-in). Chamado pelo agendador.
 * - Cada pessoa é "reservada" com um UPDATE condicional antes do envio: se o agendador
 *   rodar duas vezes ao mesmo tempo, só uma execução manda.
 * - Quem não tem saldo em aberto em nenhum grupo não recebe nada nessa semana.
 */
export async function sendWeeklySummaries(now = new Date()) {
  const cutoff = new Date(now.getTime() - 6 * DAY);
  const due = await db.userPreferences.findMany({
    where: { emailWeeklySummary: true, user: { emailVerified: true }, OR: [{ weeklySummarySentAt: null }, { weeklySummarySentAt: { lt: cutoff } }] },
    select: { userId: true, user: { select: { name: true, email: true } } },
    orderBy: { userId: "asc" },
    take: BATCH,
  });

  const { APP_URL } = env();
  let sent = 0;
  let skipped = 0;
  for (const p of due) {
    const claimed = await db.userPreferences.updateMany({
      where: { userId: p.userId, OR: [{ weeklySummarySentAt: null }, { weeklySummarySentAt: { lt: cutoff } }] },
      data: { weeklySummarySentAt: now },
    });
    if (claimed.count === 0) continue;

    const dashboard = await getDashboard({ userId: p.userId, name: p.user.name, email: p.user.email });
    const lines = dashboard.groups
      .filter((g) => !g.archived && g.balanceMinor !== 0)
      .map((g) => ({
        groupName: g.name,
        positive: g.balanceMinor > 0,
        label: g.balanceMinor > 0 ? `recebe ${formatMoney(g.balanceMinor, { currency: g.currency })}` : `deve ${formatMoney(-g.balanceMinor, { currency: g.currency })}`,
      }));
    if (lines.length === 0) {
      skipped++;
      continue;
    }
    try {
      await sendEmail(weeklySummaryMessage(p.user.email, { name: p.user.name, lines, url: `${APP_URL}/inicio`, settingsUrl: `${APP_URL}/perfil#notificacoes` }));
      sent++;
    } catch {
      logger.error("weekly_summary.email_failed");
    }
  }
  logger.info("weekly_summary.done", { due: due.length, sent, skipped });
  return { due: due.length, sent, skipped, more: due.length === BATCH };
}
