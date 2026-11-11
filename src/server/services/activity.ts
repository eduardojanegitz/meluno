import "server-only";
import type { ActivityType, NotificationType, Prisma } from "@/generated/prisma/client";
import { scheduleDelivery } from "@/server/notifications/deliver";
import type { Tx } from "./access";

type LogInput = {
  groupId: string;
  actorMemberId: string | null;
  type: ActivityType;
  entityType?: "expense" | "settlement" | "member" | "group" | "invitation";
  entityId?: string;
  payload?: Prisma.InputJsonValue;
};

/** Registro de auditoria (somente inserção), sempre na mesma transação da alteração. */
export async function logActivity(tx: Tx, input: LogInput) {
  await tx.activityLog.create({
    data: {
      groupId: input.groupId,
      actorMemberId: input.actorMemberId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload ?? {},
    },
  });
}

/** Notificação in-app para os demais membros com conta (exceto o autor). */
export async function notifyGroup(
  tx: Tx,
  groupId: string,
  exceptUserId: string,
  type: NotificationType,
  payload: Prisma.InputJsonValue,
  onlyMemberIds?: string[],
) {
  const members = await tx.groupMember.findMany({
    where: {
      groupId,
      status: "ACTIVE",
      userId: { not: null },
      ...(onlyMemberIds ? { id: { in: onlyMemberIds } } : {}),
    },
    select: { userId: true },
  });
  const data = members
    .map((m) => m.userId!)
    .filter((id) => id !== exceptUserId)
    .map((userId) => ({ userId, type, groupId, payload }));
  if (data.length === 0) return;
  const created = await tx.notification.createManyAndReturn({ data, select: { id: true } });
  // E-mail e push saem depois da resposta, só se a transação tiver sido gravada.
  scheduleDelivery(created.map((n) => n.id));
}
