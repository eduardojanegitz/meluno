import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { createExpense, getExpense, updateExpense } from "@/server/services/expenses";
import { getGroupDetail } from "@/server/services/queries";
import { resetDb, createTestDb } from "../support/db";
import { makeGroup, makeUser, memberOf } from "../support/factories";

const admin = createTestDb();

describe("despesa dividida por item (integração)", () => {
  beforeEach(() => resetDb(admin));
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  async function setup() {
    const [ana, bia, caio] = [await makeUser("Ana"), await makeUser("Bia"), await makeUser("Caio")];
    const g = await makeGroup(ana, [bia, caio]);
    const [ma, mb, mc] = [await memberOf(ana, g), await memberOf(bia, g), await memberOf(caio, g)];
    return { ana, bia, g, ma, mb, mc };
  }

  const restaurant = (ma: string, mb: string, mc: string) => ({
    items: [
      { description: "Pizza", amountMinor: 6000, memberIds: [ma, mb, mc] },
      { description: "Cerveja", amountMinor: 3000, memberIds: [ma, mb] },
      { description: "Suco", amountMinor: 1000, memberIds: [mc] },
    ],
    serviceBp: 1000,
    feesMinor: 500,
  });

  it("grava itens, serviço e taxas; os saldos refletem o consumo de cada um", async () => {
    const { ana, g, ma, mb, mc } = await setup();
    const expenseId = randomUUID();
    await createExpense(ana, {
      groupId: g,
      expenseId,
      description: "Jantar",
      amountMinor: 11500,
      date: "2026-11-10",
      payers: [{ memberId: ma.id, amountMinor: 11500 }],
      split: { method: "ITEMS", entries: [{ memberId: ma.id }, { memberId: mb.id }, { memberId: mc.id }], ...restaurant(ma.id, mb.id, mc.id) },
    });

    const { expense } = await getExpense(ana, g, expenseId);
    expect(expense).toMatchObject({ splitMethod: "ITEMS", serviceBp: 1000, feesMinor: 500, amountMinor: 11500 });
    expect(expense.items.map((i) => i.description)).toEqual(["Pizza", "Cerveja", "Suco"]);
    expect(Object.fromEntries(expense.splits.map((s) => [s.memberId, s.amountMinor]))).toEqual({ [ma.id]: 4025, [mb.id]: 4025, [mc.id]: 3450 });

    const detail = await getGroupDetail(ana, g);
    const bal = Object.fromEntries(detail.members.map((m) => [m.id, m.balanceMinor]));
    expect(bal).toEqual({ [ma.id]: 11500 - 4025, [mb.id]: -4025, [mc.id]: -3450 });
  });

  it("o servidor recalcula: total diferente da soma dos itens é recusado", async () => {
    const { ana, g, ma, mb, mc } = await setup();
    await expect(
      createExpense(ana, {
        groupId: g,
        expenseId: randomUUID(),
        description: "Jantar",
        amountMinor: 11000,
        date: "2026-11-10",
        payers: [{ memberId: ma.id, amountMinor: 11000 }],
        split: { method: "ITEMS", entries: [{ memberId: ma.id }], ...restaurant(ma.id, mb.id, mc.id) },
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "VALIDATION");
  });

  it("editar de itens para igual remove os itens e as taxas", async () => {
    const { ana, g, ma, mb, mc } = await setup();
    const expenseId = randomUUID();
    await createExpense(ana, {
      groupId: g,
      expenseId,
      description: "Jantar",
      amountMinor: 11500,
      date: "2026-11-10",
      payers: [{ memberId: ma.id, amountMinor: 11500 }],
      split: { method: "ITEMS", entries: [{ memberId: ma.id }], ...restaurant(ma.id, mb.id, mc.id) },
    });
    await updateExpense(ana, {
      groupId: g,
      expenseId,
      version: 1,
      description: "Jantar",
      amountMinor: 9000,
      date: "2026-11-10",
      payers: [{ memberId: ma.id, amountMinor: 9000 }],
      split: { method: "EQUAL", entries: [{ memberId: ma.id }, { memberId: mb.id }, { memberId: mc.id }] },
    });
    const { expense } = await getExpense(ana, g, expenseId);
    expect(expense).toMatchObject({ splitMethod: "EQUAL", serviceBp: null, feesMinor: null });
    expect(expense.items).toHaveLength(0);
    expect(await db.expenseItem.count()).toBe(0);
  });

  it("o banco recusa serviço fora do limite e campos de item em outro método", async () => {
    const { ana, g, ma } = await setup();
    const expenseId = randomUUID();
    await createExpense(ana, {
      groupId: g,
      expenseId,
      description: "Mercado",
      amountMinor: 1000,
      date: "2026-11-10",
      payers: [{ memberId: ma.id, amountMinor: 1000 }],
      split: { method: "EQUAL", entries: [{ memberId: ma.id }] },
    });
    await expect(admin.$executeRawUnsafe(`UPDATE expense SET "serviceBp" = 500, "feesMinor" = 0 WHERE id = '${expenseId}'`)).rejects.toThrow(/coherence/);
    await expect(admin.$executeRawUnsafe(`UPDATE expense SET "splitMethod" = 'ITEMS', "serviceBp" = 5000, "feesMinor" = 0 WHERE id = '${expenseId}'`)).rejects.toThrow(/service_bp_range/);
  });
});
