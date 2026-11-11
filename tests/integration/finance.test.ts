import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { createExpense, deleteExpense, restoreExpense, updateExpense } from "@/server/services/expenses";
import { confirmSettlement, createSettlement, rejectSettlement } from "@/server/services/settlements";
import { getDashboard, getGroupDetail } from "@/server/services/queries";
import { leaveGroup, addProvisionalMember } from "@/server/services/groups";
import { resetDb } from "../support/db";
import { createTestDb } from "../support/db";
import { equalExpense, key, makeGroup, makeUser, memberOf } from "../support/factories";

const admin = createTestDb();

async function balancesOf(viewer: Parameters<typeof getGroupDetail>[0], groupId: string) {
  const detail = await getGroupDetail(viewer, groupId);
  return Object.fromEntries(detail.members.map((m) => [m.name, m.balanceMinor]));
}

describe("fluxos financeiros (integração)", () => {
  beforeEach(() => resetDb(admin));
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  it("exemplo do briefing: João pagou 180, Maria 60, Pedro 0 → +100 / −20 / −80", async () => {
    const [joao, maria, pedro] = [await makeUser("João"), await makeUser("Maria"), await makeUser("Pedro")];
    const g = await makeGroup(joao, [maria, pedro]);
    const [mj, mm, mp] = [await memberOf(joao, g), await memberOf(maria, g), await memberOf(pedro, g)];

    await createExpense(joao, {
      groupId: g,
      description: "Churrasco",
      amountMinor: 24000,
      date: "2026-11-08",
      payers: [
        { memberId: mj.id, amountMinor: 18000 },
        { memberId: mm.id, amountMinor: 6000 },
      ],
      split: { method: "EQUAL", entries: [{ memberId: mj.id }, { memberId: mm.id }, { memberId: mp.id }] },
      expenseId: randomUUID(),
    });

    expect(await balancesOf(joao, g)).toEqual({ João: 10000, Maria: -2000, Pedro: -8000 });
    const { suggestions } = await getGroupDetail(joao, g);
    expect(suggestions).toEqual([
      { fromMemberId: mp.id, toMemberId: mj.id, amountMinor: 8000 },
      { fromMemberId: mm.id, toMemberId: mj.id, amountMinor: 2000 },
    ]);
  });

  it("cenário 8 — pagamento parcial confirmado reduz a dívida: deve 100, paga 40, restam 60", async () => {
    const [joao, maria] = [await makeUser("João"), await makeUser("Maria")];
    const g = await makeGroup(joao, [maria]);
    const [mj, mm] = [await memberOf(joao, g), await memberOf(maria, g)];
    await equalExpense(joao, g, 20000, mj.id, [mj.id, mm.id]);

    // Registrado pelo recebedor (João): confirmado na hora.
    const s = await createSettlement(joao, { groupId: g, fromMemberId: mm.id, toMemberId: mj.id, amountMinor: 4000, date: "2026-11-10", idempotencyKey: key() });
    expect(s.status).toBe("CONFIRMED");
    expect(await balancesOf(joao, g)).toEqual({ João: 6000, Maria: -6000 });
  });

  it("cenário 9 — pagamento integral registrado pelo pagador só conta após confirmação", async () => {
    const [joao, maria] = [await makeUser("João"), await makeUser("Maria")];
    const g = await makeGroup(joao, [maria]);
    const [mj, mm] = [await memberOf(joao, g), await memberOf(maria, g)];
    await equalExpense(joao, g, 9000, mj.id, [mj.id, mm.id]);

    const s = await createSettlement(maria, { groupId: g, fromMemberId: mm.id, toMemberId: mj.id, amountMinor: 4500, date: "2026-11-10", idempotencyKey: key() });
    expect(s.status).toBe("PENDING");
    expect(await balancesOf(joao, g)).toEqual({ João: 4500, Maria: -4500 });

    // Maria (pagadora) não pode confirmar o próprio pagamento.
    await expect(confirmSettlement(maria, { groupId: g, settlementId: s.settlementId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await confirmSettlement(joao, { groupId: g, settlementId: s.settlementId });
    expect(await balancesOf(joao, g)).toEqual({ João: 0, Maria: 0 });

    // Decidir de novo não é permitido.
    await expect(confirmSettlement(joao, { groupId: g, settlementId: s.settlementId })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("pagamento recusado nunca afeta o saldo", async () => {
    const [joao, maria] = [await makeUser("João"), await makeUser("Maria")];
    const g = await makeGroup(joao, [maria]);
    const [mj, mm] = [await memberOf(joao, g), await memberOf(maria, g)];
    await equalExpense(joao, g, 9000, mj.id, [mj.id, mm.id]);
    const s = await createSettlement(maria, { groupId: g, fromMemberId: mm.id, toMemberId: mj.id, amountMinor: 4500, date: "2026-11-10", idempotencyKey: key() });
    await rejectSettlement(joao, { groupId: g, settlementId: s.settlementId });
    expect(await balancesOf(joao, g)).toEqual({ João: 4500, Maria: -4500 });
  });

  it("administrador confirma pagamento para membro provisório (sem conta)", async () => {
    const [ana, caio] = [await makeUser("Ana"), await makeUser("Caio")];
    const g = await makeGroup(ana, [caio]);
    const { memberId: tio } = await addProvisionalMember(ana, { groupId: g, name: "Tio Carlos" });
    const mc = await memberOf(caio, g);
    const s = await createSettlement(caio, { groupId: g, fromMemberId: mc.id, toMemberId: tio, amountMinor: 1000, date: "2026-11-10", idempotencyKey: key() });
    expect(s.status).toBe("PENDING");
    // Caio não é admin: não pode confirmar por Tio Carlos.
    await expect(confirmSettlement(caio, { groupId: g, settlementId: s.settlementId })).rejects.toBeInstanceOf(AppError);
    await confirmSettlement(ana, { groupId: g, settlementId: s.settlementId });
    expect((await balancesOf(ana, g))["Tio Carlos"]).toBe(-1000);
  });

  it("cenário 10 — editar despesa recalcula saldos e guarda antes/depois no histórico", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana, [bia]);
    const [ma, mb] = [await memberOf(ana, g), await memberOf(bia, g)];
    const { expenseId } = await equalExpense(ana, g, 10000, ma.id, [ma.id, mb.id], "Mercado");
    expect(await balancesOf(ana, g)).toEqual({ Ana: 5000, Bia: -5000 });

    await updateExpense(ana, {
      groupId: g,
      expenseId,
      version: 1,
      description: "Mercado (corrigido)",
      amountMinor: 15000,
      date: "2026-11-10",
      payers: [{ memberId: ma.id, amountMinor: 15000 }],
      split: { method: "PERCENT", entries: [{ memberId: ma.id, value: 2000 }, { memberId: mb.id, value: 8000 }] },
    });
    expect(await balancesOf(ana, g)).toEqual({ Ana: 12000, Bia: -12000 });

    const log = await db.activityLog.findFirstOrThrow({ where: { entityId: expenseId, type: "EXPENSE_UPDATED" } });
    const payload = log.payload as { before: { amountMinor: number }; after: { amountMinor: number; version: number } };
    expect(payload.before.amountMinor).toBe(10000);
    expect(payload.after.amountMinor).toBe(15000);
    expect(payload.after.version).toBe(2);
  });

  it("cenário 11 — excluir despesa remove do saldo, mantém histórico e pode ser restaurada", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana, [bia]);
    const [ma, mb] = [await memberOf(ana, g), await memberOf(bia, g)];
    const { expenseId } = await equalExpense(ana, g, 10000, ma.id, [ma.id, mb.id]);

    await deleteExpense(ana, { groupId: g, expenseId });
    expect(await balancesOf(ana, g)).toEqual({ Ana: 0, Bia: 0 });
    expect(await db.expense.count({ where: { id: expenseId } })).toBe(1); // nada foi apagado de fato
    expect(await db.activityLog.count({ where: { entityId: expenseId, type: "EXPENSE_DELETED" } })).toBe(1);

    await restoreExpense(ana, { groupId: g, expenseId });
    expect(await balancesOf(ana, g)).toEqual({ Ana: 5000, Bia: -5000 });
  });

  it("só o autor ou um administrador pode editar ou excluir", async () => {
    const [ana, bia, caio] = [await makeUser("Ana"), await makeUser("Bia"), await makeUser("Caio")];
    const g = await makeGroup(ana, [bia, caio]);
    const [mb, mc] = [await memberOf(bia, g), await memberOf(caio, g)];
    const { expenseId } = await equalExpense(bia, g, 1000, mb.id, [mb.id, mc.id]);
    await expect(deleteExpense(caio, { groupId: g, expenseId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteExpense(ana, { groupId: g, expenseId }); // Ana é admin
  });

  it("rejeita divisão que não fecha com o total (validação no servidor)", async () => {
    const ana = await makeUser("Ana");
    const g = await makeGroup(ana);
    const ma = await memberOf(ana, g);
    await expect(
      createExpense(ana, {
        groupId: g,
        description: "x",
        amountMinor: 1000,
        date: "2026-11-10",
        payers: [{ memberId: ma.id, amountMinor: 1000 }],
        split: { method: "EXACT", entries: [{ memberId: ma.id, value: 999 }] },
        expenseId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await db.expense.count()).toBe(0);
  });

  it("não deixa sair do grupo com saldo pendente", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const g = await makeGroup(ana, [bia]);
    const [ma, mb] = [await memberOf(ana, g), await memberOf(bia, g)];
    await equalExpense(ana, g, 1000, ma.id, [ma.id, mb.id]);
    await expect(leaveGroup(bia, g)).rejects.toMatchObject({ code: "VALIDATION" });
    await createSettlement(ana, { groupId: g, fromMemberId: mb.id, toMemberId: ma.id, amountMinor: 500, date: "2026-11-10", idempotencyKey: key() });
    await leaveGroup(bia, g);
    expect((await memberOf(bia, g)).status).toBe("LEFT");
  });

  it("dashboard soma saldos por moeda sem misturar moedas", async () => {
    const [ana, bia] = [await makeUser("Ana"), await makeUser("Bia")];
    const brl = await makeGroup(ana, [bia], "Casa");
    const usd = await makeGroup(ana, [bia], "Viagem");
    await db.group.update({ where: { id: usd }, data: { currency: "USD" } });
    const [ma1, mb1, ma2, mb2] = [await memberOf(ana, brl), await memberOf(bia, brl), await memberOf(ana, usd), await memberOf(bia, usd)];
    await equalExpense(ana, brl, 10000, ma1.id, [ma1.id, mb1.id]);
    await equalExpense(bia, usd, 3000, mb2.id, [ma2.id, mb2.id]);

    const d = await getDashboard(ana);
    expect(d.totals).toEqual([
      { currency: "BRL", receivableMinor: 5000, payableMinor: 0, netMinor: 5000 },
      { currency: "USD", receivableMinor: 0, payableMinor: 1500, netMinor: -1500 },
    ]);
  });
});
