import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import type { Viewer } from "@/server/auth/session";
import { createExpense } from "@/server/services/expenses";
import { createGroup } from "@/server/services/groups";

let seq = 0;

/** Cria um usuário verificado diretamente no banco e devolve o Viewer correspondente. */
export async function makeUser(name: string): Promise<Viewer> {
  seq++;
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${seq}@example.test`;
  const user = await db.user.create({ data: { id: randomUUID(), name, email, emailVerified: true } });
  return { userId: user.id, name: user.name, email: user.email };
}

export async function memberOf(viewer: Viewer, groupId: string) {
  return db.groupMember.findFirstOrThrow({ where: { groupId, userId: viewer.userId } });
}

/** Grupo com o dono como admin e os demais já como membros ativos. */
export async function makeGroup(owner: Viewer, others: Viewer[] = [], name = "Grupo de teste") {
  const { groupId } = await createGroup(owner, { name, category: "FRIENDS", currency: "BRL", people: [] });
  for (const o of others) {
    await db.groupMember.create({ data: { groupId, userId: o.userId, displayName: o.name, status: "ACTIVE", joinedAt: new Date() } });
  }
  return groupId;
}

export const key = () => randomUUID().replace(/-/g, "");

/** Atalho: despesa igualitária paga integralmente por `payerMemberId`. */
export async function equalExpense(viewer: Viewer, groupId: string, amountMinor: number, payerMemberId: string, participantIds: string[], description = "Despesa") {
  return createExpense(viewer, {
    groupId,
    description,
    amountMinor,
    date: "2026-11-10",
    category: "OTHER",
    payers: [{ memberId: payerMemberId, amountMinor }],
    split: { method: "EQUAL", entries: participantIds.map((memberId) => ({ memberId })) },
    expenseId: randomUUID(),
  });
}
