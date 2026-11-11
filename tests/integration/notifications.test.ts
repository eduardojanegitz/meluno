import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Chaves VAPID de teste (não usadas de verdade: o web-push é simulado).
process.env.VAPID_PUBLIC_KEY = "BPx-teste-publica";
process.env.VAPID_PRIVATE_KEY = "teste-privada";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));
type Mail = { to: string; subject: string; text: string };
const sendEmail = vi.fn<(message: Mail) => Promise<void>>(async () => undefined);
vi.mock("@/server/email/mailer", () => ({ sendEmail: (message: Mail) => sendEmail(message) }));

const { db } = await import("@/server/db");
const { createExpense } = await import("@/server/services/expenses");
const { createSettlement } = await import("@/server/services/settlements");
const { deliverNotifications } = await import("@/server/notifications/deliver");
const { isAllowedPushEndpoint, subscribePush, subscribeSchema, unsubscribePush } = await import("@/server/services/push");
const { updateNotificationPrefs } = await import("@/server/services/profile");
const { sendWeeklySummaries } = await import("@/server/services/weekly-summary");
const { createTestDb, resetDb } = await import("../support/db");
const { makeGroup, makeUser, memberOf, key } = await import("../support/factories");

const admin = createTestDb();
const FCM = "https://fcm.googleapis.com/fcm/send/abc123";
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA", auth: "tBHItJI5svbpez7KI4CCXg" };

describe("notificações: e-mail, push e resumo semanal", () => {
  beforeEach(async () => {
    await resetDb(admin);
    sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
    sendEmail.mockClear();
  });
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  async function setup() {
    const ana = await makeUser("Ana");
    const bia = await makeUser("Bia");
    const caio = await makeUser("Caio");
    const g = await makeGroup(ana, [bia, caio], "Casa");
    return { ana, bia, caio, g, ma: await memberOf(ana, g), mb: await memberOf(bia, g), mc: await memberOf(caio, g) };
  }

  const expense = (ana: { userId: string }, g: string, payer: string, ids: string[]) =>
    createExpense(ana as never, {
      groupId: g,
      expenseId: randomUUID(),
      description: "Mercado",
      amountMinor: 9000,
      date: "2026-11-10",
      payers: [{ memberId: payer, amountMinor: 9000 }],
      split: { method: "EQUAL", entries: ids.map((memberId) => ({ memberId })) },
    });

  it("despesa nova: e-mail só para quem ativou, push para cada aparelho, nunca para o autor", async () => {
    const { ana, bia, caio, g, ma, mb, mc } = await setup();
    await updateNotificationPrefs(bia, { emailOnExpense: true });
    await subscribePush(caio, { endpoint: FCM, keys, device: "Chrome no Android" });
    await subscribePush(ana, { endpoint: `${FCM}-ana`, keys });

    await expense(ana, g, ma.id, [ma.id, mb.id, mc.id]);
    const ids = (await db.notification.findMany({ select: { id: true } })).map((n) => n.id);
    expect(ids).toHaveLength(2); // Bia e Caio
    await deliverNotifications(ids);

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]![0]).toMatchObject({ to: bia.email, subject: expect.stringContaining("Ana adicionou “Mercado”") });
    expect(sendNotification).toHaveBeenCalledOnce();
    const [sub, body] = sendNotification.mock.calls[0]!;
    expect(sub).toMatchObject({ endpoint: FCM });
    expect(JSON.parse(body as string)).toMatchObject({ title: "Casa", url: `/grupos/${g}`, body: expect.stringContaining("R$") });
    expect((await db.pushSubscription.findUniqueOrThrow({ where: { endpoint: FCM } })).lastUsedAt).not.toBeNull();
  });

  it("pagamento: e-mail de pagamentos vem ligado por padrão", async () => {
    const { ana, bia, g, ma, mb } = await setup();
    await expense(ana, g, ma.id, [ma.id, mb.id]);
    await db.notification.deleteMany();
    await createSettlement(bia, { groupId: g, idempotencyKey: key(), fromMemberId: mb.id, toMemberId: ma.id, amountMinor: 4500, date: "2026-11-11", method: "PIX" });
    await deliverNotifications((await db.notification.findMany({ select: { id: true } })).map((n) => n.id));
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]![0]).toMatchObject({ to: ana.email });
  });

  it("transação desfeita não entrega nada (a entrega relê as linhas pelo id)", async () => {
    await deliverNotifications([randomUUID()]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("inscrição que o serviço de push diz não existir mais (410) é apagada", async () => {
    const { ana, caio, g, ma, mc } = await setup();
    await subscribePush(caio, { endpoint: FCM, keys });
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));
    await expense(ana, g, ma.id, [ma.id, mc.id]);
    await deliverNotifications((await db.notification.findMany({ select: { id: true } })).map((n) => n.id));
    expect(await db.pushSubscription.count()).toBe(0);
  });

  it("só aceita endpoints dos serviços de push oficiais (anti-SSRF)", () => {
    for (const ok of [FCM, "https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/abc", "https://wns2-par02p.notify.windows.com/w/?token=x"]) {
      expect(isAllowedPushEndpoint(ok), ok).toBe(true);
    }
    for (const bad of ["http://fcm.googleapis.com/x", "https://169.254.169.254/latest", "https://localhost/push", "https://fcm.googleapis.com.evil.com/x", "https://fcm.googleapis.com:8443/x", "nada"]) {
      expect(isAllowedPushEndpoint(bad), bad).toBe(false);
    }
    expect(subscribeSchema.safeParse({ endpoint: "https://intranet.local/push", keys }).success).toBe(false);
  });

  it("aparelho compartilhado: o endpoint passa para quem se inscreveu por último; cancelar só remove o próprio", async () => {
    const { ana, bia } = await setup();
    await subscribePush(ana, { endpoint: FCM, keys });
    await subscribePush(bia, { endpoint: FCM, keys });
    expect((await db.pushSubscription.findUniqueOrThrow({ where: { endpoint: FCM } })).userId).toBe(bia.userId);
    await unsubscribePush(ana, { endpoint: FCM });
    expect(await db.pushSubscription.count()).toBe(1);
    await unsubscribePush(bia, { endpoint: FCM });
    expect(await db.pushSubscription.count()).toBe(0);
  });

  it("resumo semanal: só para quem ativou e tem saldo; não repete na mesma semana", async () => {
    const { ana, bia, caio, g, ma, mb, mc } = await setup();
    await expense(ana, g, ma.id, [ma.id, mb.id]); // Ana recebe 45, Bia deve 45, Caio zerado
    await updateNotificationPrefs(ana, { emailWeeklySummary: true });
    await updateNotificationPrefs(bia, { emailWeeklySummary: true });
    await updateNotificationPrefs(caio, { emailWeeklySummary: true });
    void mc;

    const monday = new Date("2026-11-16T11:00:00Z");
    expect(await sendWeeklySummaries(monday)).toMatchObject({ due: 3, sent: 2, skipped: 1 });
    const bodies = sendEmail.mock.calls.map((c) => c[0]);
    expect(bodies.find((b) => b.to === ana.email)?.text).toContain("Casa: recebe R$");
    expect(bodies.find((b) => b.to === bia.email)?.text).toContain("Casa: deve R$");

    sendEmail.mockClear();
    expect(await sendWeeklySummaries(new Date("2026-11-17T11:00:00Z"))).toMatchObject({ due: 0, sent: 0 });
    expect(await sendWeeklySummaries(new Date("2026-11-23T11:00:00Z"))).toMatchObject({ sent: 2 });
  });
});
