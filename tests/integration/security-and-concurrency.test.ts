import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createExpense, deleteExpense, getExpense, updateExpense } from "@/server/services/expenses";
import { createSettlement } from "@/server/services/settlements";
import { getGroupDetail, listActivity } from "@/server/services/queries";
import { addProvisionalMember, leaveGroup, updateGroup } from "@/server/services/groups";
import { acceptInvitation, createInvitation, previewInvitation } from "@/server/services/invitations";
import { getMemberPixKeys } from "@/server/services/profile";
import { computeBalances } from "@/server/domain/balance";
import { createTestDb, resetDb } from "../support/db";
import { equalExpense, key, makeGroup, makeUser, memberOf } from "../support/factories";

const admin = createTestDb();

describe("cenário 13 — isolamento entre grupos", () => {
  beforeEach(() => resetDb(admin));
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  it("quem não é membro não lê nem altera nada — e recebe NOT_FOUND, não FORBIDDEN", async () => {
    const [ana, bia, intrusa] = [await makeUser("Ana"), await makeUser("Bia"), await makeUser("Intrusa")];
    const g = await makeGroup(ana, [bia]);
    const [ma, mb] = [await memberOf(ana, g), await memberOf(bia, g)];
    const { expenseId } = await equalExpense(ana, g, 1000, ma.id, [ma.id, mb.id]);

    const notFound = { code: "NOT_FOUND" };
    await expect(getGroupDetail(intrusa, g)).rejects.toMatchObject(notFound);
    await expect(getExpense(intrusa, g, expenseId)).rejects.toMatchObject(notFound);
    await expect(deleteExpense(intrusa, { groupId: g, expenseId })).rejects.toMatchObject(notFound);
    await expect(updateGroup(intrusa, { groupId: g, name: "Hack", category: "OTHER", simplifyDebts: true })).rejects.toMatchObject(notFound);
    await expect(listActivity(intrusa, { groupId: g })).rejects.toMatchObject(notFound);
    await expect(getMemberPixKeys(intrusa, g, ma.id)).rejects.toMatchObject(notFound);
    await expect(
      createSettlement(intrusa, { groupId: g, fromMemberId: mb.id, toMemberId: ma.id, amountMinor: 100, date: "2026-11-10", idempotencyKey: key() }),
    ).rejects.toMatchObject(notFound);

    // O feed geral da intrusa não traz nada do grupo alheio.
    expect((await listActivity(intrusa)).items).toHaveLength(0);
  });

  it("não aceita membros de outro grupo numa despesa", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g1 = await makeGroup(ana);
    const g2 = await makeGroup(bia);
    const ma = await memberOf(ana, g1);
    const mbOther = await memberOf(bia, g2);
    await expect(equalExpense(ana, g1, 1000, ma.id, [ma.id, mbOther.id])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(equalExpense(ana, g1, 1000, mbOther.id, [ma.id])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("não permite manipular despesa de outro grupo passando um groupId diferente", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const gAna = await makeGroup(ana);
    const gBia = await makeGroup(bia);
    const mb = await memberOf(bia, gBia);
    const { expenseId } = await equalExpense(bia, gBia, 1000, mb.id, [mb.id]);
    // Ana é admin do próprio grupo, mas a despesa pertence a outro.
    await expect(deleteExpense(ana, { groupId: gAna, expenseId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await db.expense.findUniqueOrThrow({ where: { id: expenseId } })).deletedAt).toBeNull();
  });

  it("ex-membro perde o acesso", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana, [bia]);
    await leaveGroup(bia, g);
    await expect(getGroupDetail(bia, g)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("convites e identidade", () => {
  beforeEach(() => resetDb(admin));

  it("convite por e-mail: a conta com o mesmo e-mail assume o membro provisório e seu histórico", async () => {
    const ana = await makeUser("Ana");
    const g = await makeGroup(ana);
    const ma = await memberOf(ana, g);
    const bia = await makeUser("Bia");
    const { memberId: provisional } = await addProvisionalMember(ana, { groupId: g, name: "Bia (provisória)" });
    await equalExpense(ana, g, 1000, ma.id, [ma.id, provisional]);

    const { url } = await createInvitation(ana, { kind: "EMAIL", groupId: g, email: bia.email, memberId: provisional });
    const token = url.split("/").pop()!;
    await acceptInvitation(bia, token);

    const mb = await memberOf(bia, g);
    expect(mb.id).toBe(provisional); // mesmo registro: sem identidade duplicada
    expect(mb.status).toBe("ACTIVE");
    const detail = await getGroupDetail(bia, g);
    expect(detail.members.find((m) => m.isViewer)?.balanceMinor).toBe(-500);
  });

  it("convite por e-mail não pode ser aceito por outra conta", async () => {
    const [ana, bia, caio] = [await makeUser("Ana"), await makeUser("Bia"), await makeUser("Caio")];
    const g = await makeGroup(ana);
    const { url } = await createInvitation(ana, { kind: "EMAIL", groupId: g, email: bia.email });
    const token = url.split("/").pop()!;
    expect((await previewInvitation(caio, token)).emailMismatch).toBe(true);
    await expect(acceptInvitation(caio, token)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("convite por link: assume automaticamente o provisório com o mesmo e-mail", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana);
    const { memberId } = await addProvisionalMember(ana, { groupId: g, name: "Bia", email: bia.email });
    const { url } = await createInvitation(ana, { kind: "LINK", groupId: g });
    await acceptInvitation(bia, url.split("/").pop()!);
    expect((await memberOf(bia, g)).id).toBe(memberId);
    expect(await db.groupMember.count({ where: { groupId: g } })).toBe(2);
  });

  it("convite expirado ou revogado é recusado; token inválido não revela nada", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana);
    const { url } = await createInvitation(ana, { kind: "LINK", groupId: g });
    const token = url.split("/").pop()!;
    await db.groupInvitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await previewInvitation(bia, token)).state).toBe("EXPIRED");
    await expect(acceptInvitation(bia, token)).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await previewInvitation(bia, "x".repeat(43))).state).toBe("INVALID");
  });

  it("o token bruto nunca é armazenado", async () => {
    const ana = await makeUser("Ana");
    const g = await makeGroup(ana);
    const { url } = await createInvitation(ana, { kind: "LINK", groupId: g });
    const token = url.split("/").pop()!;
    const stored = await db.groupInvitation.findFirstOrThrow({ where: { groupId: g } });
    expect(stored.tokenHash).not.toContain(token);
    expect(stored.tokenHash).toHaveLength(64);
  });
});

describe("cenário 14 — operações simultâneas", () => {
  beforeEach(() => resetDb(admin));

  it("duas edições simultâneas da mesma versão: uma vence, a outra recebe CONFLICT", async () => {
    const ana = await makeUser("Ana");
    const g = await makeGroup(ana);
    const ma = await memberOf(ana, g);
    const { expenseId } = await equalExpense(ana, g, 1000, ma.id, [ma.id]);

    const edit = (amountMinor: number) =>
      updateExpense(ana, {
        groupId: g,
        expenseId,
        version: 1,
        description: `v${amountMinor}`,
        amountMinor,
        date: "2026-11-10",
        payers: [{ memberId: ma.id, amountMinor }],
        split: { method: "EQUAL", entries: [{ memberId: ma.id }] },
      });

    const results = await Promise.allSettled([edit(2000), edit(3000)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "CONFLICT" });

    const e = await db.expense.findUniqueOrThrow({ where: { id: expenseId }, include: { payers: true, splits: true } });
    expect(e.version).toBe(2);
    // Pagadores e divisões são da versão vencedora (nunca misturados).
    expect(e.payers[0]!.amountMinor).toBe(e.amountMinor);
    expect(e.splits[0]!.amountMinor).toBe(e.amountMinor);
  });

  it("reenvio simultâneo com a mesma chave de idempotência cria uma única despesa", async () => {
    const ana = await makeUser("Ana");
    const g = await makeGroup(ana);
    const ma = await memberOf(ana, g);
    const k = randomUUID();
    const send = () =>
      createExpense(ana, {
        groupId: g,
        description: "Pizza",
        amountMinor: 8000,
        date: "2026-11-10",
        payers: [{ memberId: ma.id, amountMinor: 8000 }],
        split: { method: "EQUAL", entries: [{ memberId: ma.id }] },
        expenseId: k,
      });
    const results = await Promise.all([send(), send(), send()]);
    expect(new Set(results.map((r) => r.expenseId)).size).toBe(1);
    expect(await db.expense.count()).toBe(1);
  });

  it("muitas despesas e acertos em paralelo mantêm a soma dos saldos igual a zero", async () => {
    const users = await Promise.all(["A", "B", "C", "D"].map((n) => makeUser(n)));
    const g = await makeGroup(users[0]!, users.slice(1));
    const members = await Promise.all(users.map((u) => memberOf(u, g)));
    const ids = members.map((m) => m.id);

    await Promise.all(
      Array.from({ length: 24 }, (_, i) => {
        const u = users[i % 4]!;
        const payer = ids[i % 4]!;
        if (i % 6 === 5) {
          return createSettlement(u, { groupId: g, fromMemberId: ids[(i + 1) % 4]!, toMemberId: payer, amountMinor: 333 + i, date: "2026-11-10", idempotencyKey: key() });
        }
        return equalExpense(u, g, 1001 + i * 7, payer, ids.slice(0, 2 + (i % 3)));
      }),
    );

    const ledger = await admin.expense.findMany({ where: { groupId: g, deletedAt: null }, include: { payers: true, splits: true } });
    for (const e of ledger) {
      expect(e.payers.reduce((a, p) => a + p.amountMinor, 0)).toBe(e.amountMinor);
      expect(e.splits.reduce((a, s) => a + s.amountMinor, 0)).toBe(e.amountMinor);
    }
    const settlements = await admin.settlement.findMany({ where: { groupId: g, status: "CONFIRMED" } });
    const balances = computeBalances({ expenses: ledger, settlements });
    expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("sair do grupo e lançar despesa ao mesmo tempo não deixa saldo órfão", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana, [bia]);
    const [ma, mb] = [await memberOf(ana, g), await memberOf(bia, g)];
    const results = await Promise.allSettled([leaveGroup(bia, g), equalExpense(ana, g, 1000, ma.id, [ma.id, mb.id])]);
    const left = (await memberOf(bia, g)).status === "LEFT";
    const expenseCreated = results[1]!.status === "fulfilled";
    // Ou Bia saiu antes (e a despesa foi recusada), ou a despesa entrou antes (e Bia não pôde sair).
    expect(left && expenseCreated).toBe(false);
    expect(left || expenseCreated).toBe(true);
  });
});
