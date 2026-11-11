import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetDb } from "../support/db";

/**
 * Garante que o banco rejeita dados financeiros inválidos mesmo que um bug
 * na aplicação tente gravá-los (defesa em profundidade).
 */
const db = createTestDb();

async function seedGroup() {
  const user = await db.user.create({ data: { id: "u1", name: "Ana", email: "ana@example.test" } });
  const group = await db.group.create({ data: { name: "Casa", currency: "BRL" } });
  const ana = await db.groupMember.create({
    data: { groupId: group.id, userId: user.id, displayName: "Ana", role: "ADMIN", status: "ACTIVE" },
  });
  const bia = await db.groupMember.create({
    data: { groupId: group.id, displayName: "Bia", email: "bia@example.test", status: "PROVISIONAL" },
  });
  return { group, ana, bia };
}

describe("restrições do schema", () => {
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  it("rejeita despesa com valor zero ou negativo", async () => {
    const { group, ana } = await seedGroup();
    const base = { groupId: group.id, description: "x", currency: "BRL", date: new Date("2026-11-10"), splitMethod: "EQUAL" as const, createdByMemberId: ana.id };
    await expect(db.expense.create({ data: { ...base, amountMinor: 0 } })).rejects.toThrow();
    await expect(db.expense.create({ data: { ...base, amountMinor: -100 } })).rejects.toThrow();
    await expect(db.expense.create({ data: { ...base, amountMinor: 100 } })).resolves.toMatchObject({ amountMinor: 100 });
  });

  it("rejeita despesa acima do teto de R$ 10 milhões", async () => {
    const { group, ana } = await seedGroup();
    await expect(
      db.expense.create({
        data: { groupId: group.id, description: "x", amountMinor: 1_000_000_001, currency: "BRL", date: new Date(), splitMethod: "EQUAL", createdByMemberId: ana.id },
      }),
    ).rejects.toThrow();
  });

  it("rejeita acerto de alguém para si mesmo e com valor não positivo", async () => {
    const { group, ana, bia } = await seedGroup();
    const base = { groupId: group.id, currency: "BRL", date: new Date(), status: "CONFIRMED" as const, createdByMemberId: ana.id };
    await expect(db.settlement.create({ data: { ...base, fromMemberId: ana.id, toMemberId: ana.id, amountMinor: 100 } })).rejects.toThrow();
    await expect(db.settlement.create({ data: { ...base, fromMemberId: bia.id, toMemberId: ana.id, amountMinor: 0 } })).rejects.toThrow();
    await expect(db.settlement.create({ data: { ...base, fromMemberId: bia.id, toMemberId: ana.id, amountMinor: 4500 } })).resolves.toMatchObject({ amountMinor: 4500 });
  });

  it("rejeita divisão negativa, mas aceita divisão zero (centavo residual)", async () => {
    const { group, ana, bia } = await seedGroup();
    const expense = await db.expense.create({
      data: { groupId: group.id, description: "x", amountMinor: 1, currency: "BRL", date: new Date(), splitMethod: "EQUAL", createdByMemberId: ana.id },
    });
    await expect(db.expenseSplit.create({ data: { expenseId: expense.id, memberId: ana.id, amountMinor: -1 } })).rejects.toThrow();
    await expect(db.expenseSplit.create({ data: { expenseId: expense.id, memberId: bia.id, amountMinor: 0 } })).resolves.toBeTruthy();
  });

  it("exige coerência entre status do membro e vínculo com usuário", async () => {
    const { group } = await seedGroup();
    await expect(db.groupMember.create({ data: { groupId: group.id, displayName: "Sem conta", status: "ACTIVE" } })).rejects.toThrow();
    await expect(
      db.groupMember.create({ data: { groupId: group.id, userId: "u1", displayName: "Dup", status: "PROVISIONAL" } }),
    ).rejects.toThrow();
  });

  it("impede dois membros com o mesmo e-mail no grupo", async () => {
    const { group } = await seedGroup();
    await expect(
      db.groupMember.create({ data: { groupId: group.id, displayName: "Outra Bia", email: "bia@example.test", status: "PROVISIONAL" } }),
    ).rejects.toThrow();
  });

  it("não permite apagar um membro que tem registros financeiros", async () => {
    const { group, ana } = await seedGroup();
    await db.expense.create({
      data: { groupId: group.id, description: "x", amountMinor: 100, currency: "BRL", date: new Date(), splitMethod: "EQUAL", createdByMemberId: ana.id },
    });
    await expect(db.groupMember.delete({ where: { id: ana.id } })).rejects.toThrow();
  });

  it("ao excluir o usuário, o membro permanece (sem vínculo) para preservar o histórico", async () => {
    const { ana } = await seedGroup();
    // Status precisa sair de ACTIVE antes (exclusão de conta marca o membro como LEFT/anonimizado).
    await db.groupMember.update({ where: { id: ana.id }, data: { status: "LEFT", displayName: "Usuário removido" } });
    await db.user.delete({ where: { id: "u1" } });
    const member = await db.groupMember.findUniqueOrThrow({ where: { id: ana.id } });
    expect(member.userId).toBeNull();
    expect(member.displayName).toBe("Usuário removido");
  });
});
