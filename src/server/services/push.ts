import "server-only";
import { z } from "zod";
import type { Viewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { sendPush } from "@/server/notifications/deliver";

/**
 * Serviços de push aceitos. O servidor faz requisições para o endpoint que o navegador
 * informa; sem esta lista, uma inscrição falsa poderia apontar para a rede interna (SSRF).
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.notify\.windows\.com$/];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && !url.username && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

export const subscribeSchema = z.object({
  endpoint: z.string().max(1000).refine(isAllowedPushEndpoint, "Serviço de notificação não suportado."),
  keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }),
  device: z.string().trim().max(80).optional(),
});

export const endpointSchema = z.object({ endpoint: z.string().max(1000) });

const MAX_DEVICES = 10;

export async function subscribePush(viewer: Viewer, raw: z.input<typeof subscribeSchema>) {
  const input = subscribeSchema.parse(raw);
  // O endpoint é do navegador: se outra conta usou este aparelho antes, ele passa para quem está logado agora.
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { userId: viewer.userId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, device: input.device },
    update: { userId: viewer.userId, p256dh: input.keys.p256dh, auth: input.keys.auth, device: input.device },
  });
  // Limite de aparelhos: mantém os mais recentes.
  const extra = await db.pushSubscription.findMany({ where: { userId: viewer.userId }, orderBy: { createdAt: "desc" }, skip: MAX_DEVICES, select: { id: true } });
  if (extra.length) await db.pushSubscription.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
}

export async function unsubscribePush(viewer: Viewer, raw: z.input<typeof endpointSchema>) {
  const { endpoint } = endpointSchema.parse(raw);
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: viewer.userId } });
}

/** Notificação de teste para o aparelho atual. */
export async function testPush(viewer: Viewer, raw: z.input<typeof endpointSchema>) {
  const { endpoint } = endpointSchema.parse(raw);
  const sub = await db.pushSubscription.findFirst({ where: { endpoint, userId: viewer.userId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  if (!sub) throw new AppError("NOT_FOUND", "Este aparelho não está inscrito. Ative as notificações de novo.");
  await sendPush(sub, { title: "Meluno", body: "Tudo certo! As notificações chegam assim.", url: "/inicio", tag: "test" });
}
