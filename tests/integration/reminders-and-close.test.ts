import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { sendPaymentReminder } from "@/server/services/reminders";
import { addProvisionalMember, closeGroup, getGroupSummary } from "@/server/services/groups";
import { createSettlement } from "@/server/services/settlements";
import { addPixKey } from "@/server/services/profile";
import { resetDb, createTestDb } from "../support/db";
import { equalExpense, key, makeGroup, makeUser, memberOf } from "../support/factories";

const admin = createTestDb();

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

describe("lembretes de cobrança", () => {
  beforeEach(() => resetDb(admin));
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  it("quem recebe lembra quem deve: notifica no app e respeita o intervalo de 72 h", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana, [bia]);
    const [ma, mb] = [await memberOf(ana, g), await memberOf(bia, g)];
    await equalExpense(ana, g, 10000, ma.id, [ma.id, mb.id]);

    const r = await sendPaymentReminder(ana, { groupId: g, debtorMemberId: mb.id, channel: "EMAIL" });
    expect(r.amountMinor).toBe(5000);
    expect(await db.notification.count({ where: { userId: bia.userId, type: "PAYMENT_REMINDER" } })).toBe(1);

    // Segundo lembrete logo em seguida, por qualquer canal: bloqueado.
    await expectCode(sendPaymentReminder(ana, { groupId: g, debtorMemberId: mb.id, channel: "WHATSAPP" }), "RATE_LIMITED");
  });

  it("só cobra dívida que existe e só de quem deve a você", async () => {
    const [ana, bia, caio] = [await makeUser("Ana"), await makeUser("Bia"), await makeUser("Caio")];
    const g = await makeGroup(ana, [bia, caio]);
    const [ma, mb, mc] = [await memberOf(ana, g), await memberOf(bia, g), await memberOf(caio, g)];
    await equalExpense(ana, g, 10000, ma.id, [ma.id, mb.id]);

    // Bia não pode cobrar Ana (Ana não deve a ela) nem Caio (não deve nada).
    await expectCode(sendPaymentReminder(bia, { groupId: g, debtorMemberId: ma.id, channel: "EMAIL" }), "VALIDATION");
    await expectCode(sendPaymentReminder(ana, { groupId: g, debtorMemberId: mc.id, channel: "EMAIL" }), "VALIDATION");
    // Quitado: nada a cobrar.
    await createSettlement(ana, { groupId: g, fromMemberId: mb.id, toMemberId: ma.id, amountMinor: 5000, date: "2026-11-10", idempotencyKey: key() });
    await expectCode(sendPaymentReminder(ana, { groupId: g, debtorMemberId: mb.id, channel: "EMAIL" }), "VALIDATION");
  });

  it("pessoa sem conta só pode ser lembrada pelo WhatsApp; o Pix de quem cobra volta para a mensagem", async () => {
    const ana = await makeUser("Ana");
    const g = await makeGroup(ana);
    const ma = await memberOf(ana, g);
    const { memberId } = (await addProvisionalMember(ana, { groupId: g, name: "Duda" })) as { memberId: string };
    await equalExpense(ana, g, 3000, ma.id, [ma.id, memberId]);
    await addPixKey(ana, { type: "EMAIL", value: ana.email });

    await expectCode(sendPaymentReminder(ana, { groupId: g, debtorMemberId: memberId, channel: "EMAIL" }), "VALIDATION");
    const r = await sendPaymentReminder(ana, { groupId: g, debtorMemberId: memberId, channel: "WHATSAPP" });
    expect(r.pixCode).toContain("br.gov.bcb.pix");
    expect(r.pixCode).toContain("540515.00");
  });

  it("não deixa membro de fora do grupo cobrar", async () => {
    const [ana, bia, intruso] = [await makeUser("Ana"), await makeUser("Bia"), await makeUser("Intruso")];
    const g = await makeGroup(ana, [bia]);
    const mb = await memberOf(bia, g);
    await expectCode(sendPaymentReminder(intruso, { groupId: g, debtorMemberId: mb.id, channel: "EMAIL" }), "NOT_FOUND");
  });
});

describe("encerrar grupo", () => {
  beforeEach(() => resetDb(admin));

  it("só encerra com todo mundo quite e mostra o resumo", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana, [bia]);
    const [ma, mb] = [await memberOf(ana, g), await memberOf(bia, g)];
    await equalExpense(ana, g, 10000, ma.id, [ma.id, mb.id], "Mercado");
    await equalExpense(bia, g, 2000, mb.id, [ma.id, mb.id], "Sorvete");

    await expectCode(closeGroup(ana, g), "VALIDATION");

    await createSettlement(ana, { groupId: g, fromMemberId: mb.id, toMemberId: ma.id, amountMinor: 4000, date: "2026-11-10", idempotencyKey: key() });
    const summary = await getGroupSummary(ana, g);
    expect(summary).toMatchObject({ totalMinor: 12000, expenseCount: 2, settlementCount: 1, settled: true, topPayer: { name: "Você", amountMinor: 10000 } });

    // Só administrador encerra.
    await expectCode(closeGroup(bia, g), "FORBIDDEN");
    await closeGroup(ana, g);
    expect((await db.group.findUniqueOrThrow({ where: { id: g } })).archivedAt).not.toBeNull();
  });
});
