import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { auth } from "@/server/auth/auth";
import { AppError } from "@/server/errors";
import { deleteAccount, FRESH_SESSION_SECONDS, REMOVED_NAME } from "@/server/services/account";
import { createInvitation } from "@/server/services/invitations";
import { addPixKey } from "@/server/services/profile";
import { createSettlement } from "@/server/services/settlements";
import { getGroupDetail } from "@/server/services/queries";
import { resetDb, createTestDb } from "../support/db";
import { equalExpense, key, makeGroup, makeUser, memberOf } from "../support/factories";

const admin = createTestDb();
const PASSWORD = "senha-de-teste-123";
const fresh = { sessionCreatedAt: new Date() };

async function withPassword(userId: string) {
  const ctx = await auth.$context;
  await db.account.create({ data: { id: randomUUID(), userId, accountId: userId, providerId: "credential", password: await ctx.password.hash(PASSWORD) } });
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

describe("exclusão de conta (LGPD)", () => {
  beforeEach(() => resetDb(admin));
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  it("anonimiza a pessoa nos grupos e preserva os saldos das outras", async () => {
    const [ana, bia, caio] = [await makeUser("Ana"), await makeUser("Bia"), await makeUser("Caio")];
    const g = await makeGroup(ana, [bia, caio]);
    const [ma, mb, mc] = [await memberOf(ana, g), await memberOf(bia, g), await memberOf(caio, g)];
    await equalExpense(bia, g, 30000, mb.id, [ma.id, mb.id, mc.id]);
    await createSettlement(caio, { groupId: g, fromMemberId: mc.id, toMemberId: mb.id, amountMinor: 5000, method: "PIX", date: "2026-11-10", idempotencyKey: key() });
    const before = await getGroupDetail(bia, g);

    await withPassword(bia.userId);
    await addPixKey(bia, { type: "EMAIL", value: bia.email });
    await deleteAccount(bia, { confirmation: "excluir", password: PASSWORD }, fresh);

    expect(await db.user.findUnique({ where: { id: bia.userId } })).toBeNull();
    expect(await db.account.count({ where: { userId: bia.userId } })).toBe(0);
    expect(await db.pixKey.count({ where: { userId: bia.userId } })).toBe(0);

    const member = await db.groupMember.findUniqueOrThrow({ where: { id: mb.id } });
    expect(member).toMatchObject({ userId: null, displayName: REMOVED_NAME, email: null, status: "LEFT" });

    // Saldos idênticos: os registros financeiros continuam valendo.
    const after = await getGroupDetail(ana, g);
    const bal = (d: typeof before) => Object.fromEntries(d.members.map((m) => [m.id, m.balanceMinor]));
    expect(bal(after)).toEqual(bal(before));
    expect(after.members.reduce((s, m) => s + m.balanceMinor, 0)).toBe(0);
    expect(after.members.find((m) => m.id === mb.id)?.name).toBe(REMOVED_NAME);

    // O nome sai do histórico.
    const mentions = await db.activityLog.findMany({ where: { entityType: "member", entityId: mb.id } });
    expect(mentions.length).toBeGreaterThan(0);
    for (const a of mentions) expect(JSON.stringify(a.payload)).not.toContain("Bia");
  });

  it("promove outra pessoa quando o único administrador sai; arquiva grupo que fica sem ninguém", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const shared = await makeGroup(ana, [bia]);
    const solo = await makeGroup(ana, [], "Só meu");

    await deleteAccount(ana, { confirmation: "EXCLUIR" }, fresh);

    expect((await memberOf(bia, shared)).role).toBe("ADMIN");
    expect((await db.group.findUniqueOrThrow({ where: { id: shared } })).archivedAt).toBeNull();
    expect((await db.group.findUniqueOrThrow({ where: { id: solo } })).archivedAt).not.toBeNull();
  });

  it("apaga convites e e-mails de provisórios ligados ao e-mail da pessoa", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana);
    await createInvitation(ana, { groupId: g, kind: "EMAIL", email: bia.email });
    expect(await db.groupInvitation.count({ where: { email: bia.email } })).toBe(1);

    await deleteAccount(bia, { confirmation: "EXCLUIR" }, fresh);

    expect(await db.groupInvitation.count({ where: { email: bia.email } })).toBe(0);
    expect(await db.groupMember.count({ where: { email: bia.email } })).toBe(0);
  });

  it("exige senha correta em contas com senha", async () => {
    const ana = await makeUser("Ana");
    await withPassword(ana.userId);
    await expectCode(deleteAccount(ana, { confirmation: "EXCLUIR" }, fresh), "VALIDATION");
    await expectCode(deleteAccount(ana, { confirmation: "EXCLUIR", password: "errada-123" }, fresh), "VALIDATION");
    expect(await db.user.count({ where: { id: ana.userId } })).toBe(1);
  });

  it("conta sem senha precisa de login recente", async () => {
    const ana = await makeUser("Ana");
    const old = { sessionCreatedAt: new Date(Date.now() - (FRESH_SESSION_SECONDS + 60) * 1000) };
    await expectCode(deleteAccount(ana, { confirmation: "EXCLUIR" }, old), "VALIDATION");
    expect(await db.user.count({ where: { id: ana.userId } })).toBe(1);
  });

  it("exige a palavra de confirmação", async () => {
    const ana = await makeUser("Ana");
    await expect(deleteAccount(ana, { confirmation: "sim" }, fresh)).rejects.toThrow();
    expect(await db.user.count({ where: { id: ana.userId } })).toBe(1);
  });
});
