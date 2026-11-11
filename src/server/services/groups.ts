import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { addMemberSchema, changeRoleSchema, createGroupSchema, memberActionSchema, updateGroupSchema } from "@/schemas/group";
import { assertWritable, lockGroup, requireAdmin, requireMember } from "./access";
import { logActivity } from "./activity";
import { loadGroupLedger } from "./ledger";
import { computeBalances } from "@/server/domain/balance";

export async function createGroup(viewer: Viewer, raw: z.input<typeof createGroupSchema>) {
  const input = createGroupSchema.parse(raw);
  const emails = input.people.map((p) => p.email).filter(Boolean);
  if (emails.includes(viewer.email.toLowerCase())) {
    throw new AppError("VALIDATION", "Você já faz parte do grupo; não precisa se adicionar.");
  }
  if (new Set(emails).size !== emails.length) throw new AppError("VALIDATION", "Há e-mails repetidos na lista.");

  return db.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: { name: input.name, description: input.description, category: input.category, currency: input.currency },
    });
    const me = await tx.groupMember.create({
      data: { groupId: group.id, userId: viewer.userId, displayName: viewer.name, role: "ADMIN", status: "ACTIVE", joinedAt: new Date() },
    });
    await logActivity(tx, { groupId: group.id, actorMemberId: me.id, type: "GROUP_CREATED", entityType: "group", entityId: group.id, payload: { name: group.name } });
    for (const p of input.people) {
      const m = await tx.groupMember.create({
        data: { groupId: group.id, displayName: p.name, email: p.email ?? null, status: "PROVISIONAL" },
      });
      await logActivity(tx, { groupId: group.id, actorMemberId: me.id, type: "MEMBER_ADDED", entityType: "member", entityId: m.id, payload: { name: p.name } });
    }
    return { groupId: group.id };
  });
}

export async function updateGroup(viewer: Viewer, raw: z.input<typeof updateGroupSchema>) {
  const input = updateGroupSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const me = await requireAdmin(tx, viewer, input.groupId);
    assertWritable(me.group);
    await tx.group.update({
      where: { id: input.groupId },
      data: { name: input.name, description: input.description ?? null, category: input.category, simplifyDebts: input.simplifyDebts },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      actorMemberId: me.id,
      type: "GROUP_UPDATED",
      entityType: "group",
      entityId: input.groupId,
      payload: {
        before: { name: me.group.name, category: me.group.category, simplifyDebts: me.group.simplifyDebts },
        after: { name: input.name, category: input.category, simplifyDebts: input.simplifyDebts },
      },
    });
  });
}

export async function setGroupArchived(viewer: Viewer, groupId: string, archived: boolean) {
  return db.$transaction(async (tx) => {
    const me = await requireAdmin(tx, viewer, groupId);
    await tx.group.update({ where: { id: groupId }, data: { archivedAt: archived ? new Date() : null } });
    if (archived) await logActivity(tx, { groupId, actorMemberId: me.id, type: "GROUP_ARCHIVED", entityType: "group", entityId: groupId });
  });
}

/** Adiciona alguém sem conta (membro provisório). */
export async function addProvisionalMember(viewer: Viewer, raw: z.input<typeof addMemberSchema>) {
  const input = addMemberSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, input.groupId);
    assertWritable(me.group);
    if (input.email) {
      const clash = await tx.groupMember.findFirst({
        where: {
          groupId: input.groupId,
          status: { in: ["ACTIVE", "PROVISIONAL"] },
          OR: [{ email: input.email }, { user: { email: input.email } }],
        },
      });
      if (clash) throw new AppError("CONFLICT", "Já existe alguém com esse e-mail no grupo.");
    }
    const member = await tx.groupMember.create({
      data: { groupId: input.groupId, displayName: input.name, email: input.email ?? null, status: "PROVISIONAL" },
    });
    await logActivity(tx, { groupId: input.groupId, actorMemberId: me.id, type: "MEMBER_ADDED", entityType: "member", entityId: member.id, payload: { name: input.name } });
    return { memberId: member.id };
  });
}

export async function changeMemberRole(viewer: Viewer, raw: z.input<typeof changeRoleSchema>) {
  const input = changeRoleSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const me = await requireAdmin(tx, viewer, input.groupId);
    const target = await tx.groupMember.findFirst({ where: { id: input.memberId, groupId: input.groupId, status: "ACTIVE" } });
    if (!target) throw new AppError("NOT_FOUND", "Pessoa não encontrada no grupo.");
    if (target.role === input.role) return;
    if (input.role === "MEMBER") {
      const admins = await tx.groupMember.count({ where: { groupId: input.groupId, status: "ACTIVE", role: "ADMIN" } });
      if (admins <= 1) throw new AppError("VALIDATION", "O grupo precisa de pelo menos um administrador.");
    }
    await tx.groupMember.update({ where: { id: target.id }, data: { role: input.role } });
    await logActivity(tx, {
      groupId: input.groupId,
      actorMemberId: me.id,
      type: "MEMBER_ROLE_CHANGED",
      entityType: "member",
      entityId: target.id,
      payload: { name: target.displayName, role: input.role },
    });
  });
}

/** Sair do grupo: só com saldo zero (ADR 0001 §4). */
export async function leaveGroup(viewer: Viewer, groupId: string) {
  return db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, groupId);
    await lockGroup(tx, groupId);
    const balance = computeBalances(await loadGroupLedger(tx, groupId)).get(me.id) ?? 0;
    if (balance !== 0) throw new AppError("VALIDATION", "Acerte seu saldo antes de sair do grupo.");
    if (me.role === "ADMIN") {
      const otherAdmins = await tx.groupMember.count({ where: { groupId, status: "ACTIVE", role: "ADMIN", id: { not: me.id } } });
      const others = await tx.groupMember.count({ where: { groupId, status: "ACTIVE", id: { not: me.id } } });
      if (others > 0 && otherAdmins === 0) throw new AppError("VALIDATION", "Torne outra pessoa administradora antes de sair.");
    }
    await tx.groupMember.update({ where: { id: me.id }, data: { status: "LEFT", leftAt: new Date() } });
    await logActivity(tx, { groupId, actorMemberId: me.id, type: "MEMBER_LEFT", entityType: "member", entityId: me.id, payload: { name: me.displayName } });
  });
}

/**
 * Remoção por administrador. Com saldo ≠ 0 o membro vira "ex-membro" e
 * continua nos saldos; sem histórico financeiro, provisórios são apagados.
 */
export async function removeMember(viewer: Viewer, raw: z.input<typeof memberActionSchema>) {
  const input = memberActionSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const me = await requireAdmin(tx, viewer, input.groupId);
    if (me.id === input.memberId) throw new AppError("VALIDATION", "Para sair do grupo, use a opção Sair.");
    await lockGroup(tx, input.groupId);
    const target = await tx.groupMember.findFirst({
      where: { id: input.memberId, groupId: input.groupId, status: { in: ["ACTIVE", "PROVISIONAL"] } },
    });
    if (!target) throw new AppError("NOT_FOUND", "Pessoa não encontrada no grupo.");

    const hasHistory =
      (await tx.expensePayer.count({ where: { memberId: target.id } })) +
        (await tx.expenseSplit.count({ where: { memberId: target.id } })) +
        (await tx.settlement.count({ where: { OR: [{ fromMemberId: target.id }, { toMemberId: target.id }, { createdByMemberId: target.id }] } })) +
        (await tx.expense.count({ where: { createdByMemberId: target.id } })) +
        (await tx.activityLog.count({ where: { actorMemberId: target.id } })) +
        (await tx.groupInvitation.count({ where: { invitedByMemberId: target.id } })) >
      0;

    await tx.groupInvitation.updateMany({ where: { targetMemberId: target.id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await logActivity(tx, { groupId: input.groupId, actorMemberId: me.id, type: "MEMBER_REMOVED", entityType: "member", entityId: target.id, payload: { name: target.displayName } });
    if (!hasHistory && target.status === "PROVISIONAL") {
      await tx.groupInvitation.updateMany({ where: { targetMemberId: target.id }, data: { targetMemberId: null } });
      await tx.groupMember.delete({ where: { id: target.id } });
    } else {
      await tx.groupMember.update({ where: { id: target.id }, data: { status: "REMOVED", leftAt: new Date() } });
    }
  });
}
