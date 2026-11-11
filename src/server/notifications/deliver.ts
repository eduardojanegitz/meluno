import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { env, pushEnabled } from "@/lib/env";
import { emailPreferenceFor, notificationMessage, type NotificationPayload } from "@/lib/notification-message";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/mailer";
import { activityMessage } from "@/server/email/templates";
import { logger } from "@/server/logger";

/**
 * Entrega das notificações por e-mail e push.
 *
 * As notificações são gravadas dentro da transação de quem as gerou. A entrega acontece
 * DEPOIS da resposta (`after`) e relê as linhas pelo id: se a transação foi desfeita, as
 * linhas não existem e nada é enviado. É "melhor esforço": falhas vão para o log, sem
 * repetir. A notificação continua na tela de Atividade de qualquer jeito.
 */
export function scheduleDelivery(ids: string[]) {
  if (ids.length === 0) return;
  try {
    after(() => deliverNotifications(ids));
  } catch {
    // Fora de uma requisição (testes, scripts): quem chamou decide se entrega.
  }
}

export async function deliverNotifications(ids: string[]) {
  const notifications = await db.notification.findMany({
    where: { id: { in: ids } },
    select: {
      type: true,
      groupId: true,
      payload: true,
      user: {
        select: {
          email: true,
          emailVerified: true,
          preferences: { select: { emailOnExpense: true, emailOnSettlement: true } },
          pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
        },
      },
    },
  });

  const { APP_URL } = env();
  for (const n of notifications) {
    const msg = notificationMessage(n.type, n.payload as NotificationPayload, n.groupId);
    const url = `${APP_URL}${msg.path}`;

    const pref = emailPreferenceFor(n.type);
    const prefs = n.user.preferences ?? { emailOnExpense: false, emailOnSettlement: true };
    if (pref && prefs[pref] && n.user.emailVerified) {
      await sendEmail(activityMessage(n.user.email, { title: msg.title, body: msg.body, url, settingsUrl: `${APP_URL}/perfil#notificacoes` })).catch(() =>
        logger.error("notification.email_failed", { type: n.type }),
      );
    }

    for (const sub of n.user.pushSubscriptions) await sendPush(sub, { title: msg.title, body: msg.body, url: msg.path, tag: n.type });
  }
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

/** Envia um push. Inscrição que o serviço de push diz não existir mais (404/410) é apagada. */
export async function sendPush(sub: Sub, data: { title: string; body: string; url: string; tag?: string }) {
  if (!pushEnabled()) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(data), {
      vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY },
      TTL: 60 * 60 * 24,
      urgency: "normal",
    });
    await db.pushSubscription.update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      return;
    }
    logger.warn("notification.push_failed", { status: status ?? "unknown" });
  }
}
