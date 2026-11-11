import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { civilDateToDb } from "@/schemas/common";
import { createSettlementSchema, settlementRefSchema } from "@/schemas/settlement";
import { assertGroupMembers, assertWritable, lockGroup, requireMember, type Tx } from "./access";
import { logActivity, notifyGroup } from "./activity";

/**
 * Acertos (pagamentos entre membros). Regras (ADR 0001 §2):
 *  - Registrado pelo RECEBEDOR → CONFIRMED (afeta o saldo imediatamente).
 *  - Registrado por outra pessoa → PENDING (não afeta o saldo) até o
 *    recebedor confirmar. Se o recebedor é provisório (sem conta), qualquer
 *    administrador pode confirmar.
 *  - O Meluno não movimenta dinheiro: um acerto é um registro manual.
 */

type Member = { id: string; userId: string | null; status: string; role: string };

function canDecide(me: Member, receiver: Member) {
  if (receiver.id === me.id) return true;
  return receiver.status === "PROVISIONAL" && me.role === "ADMIN";
}

export async function createSettlement(viewer: Viewer, raw: z.input<typeof createSettlementSchema>) {
  const input = createSettlementSchema.parse(raw);
  try {
    return await db.$transaction(async (tx) => {
      const me = await requireMember(tx, viewer, input.groupId);
      assertWritable(me.group);
      await lockGroup(tx, input.groupId);

      const duplicate = await tx.settlement.findUnique({
        where: { createdByMemberId_idempotencyKey: { createdByMemberId: me.id, idempotencyKey: input.idempotencyKey } },
        select: { id: true, status: true },
      });
      if (duplicate) return { settlementId: duplicate.id, status: duplicate.status };

      await assertGroupMembers(tx, input.groupId, [input.fromMemberId, input.toMemberId]);
      const receiver = await tx.groupMember.findUniqueOrThrow({ where: { id: input.toMemberId } });
      const status = receiver.id === me.id ? "CONFIRMED" : "PENDING";

      const settlement = await tx.settlement.create({
        data: {
          groupId: input.groupId,
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amountMinor: input.amountMinor,
          currency: me.group.currency,
          date: civilDateToDb(input.date),
          method: input.method,
          note: input.note,
          status,
          idempotencyKey: input.idempotencyKey,
          createdByMemberId: me.id,
          ...(status === "CONFIRMED" ? { decidedByMemberId: me.id, decidedAt: new Date() } : {}),
        },
      });

      await logActivity(tx, {
        groupId: input.groupId,
        actorMemberId: me.id,
        type: "SETTLEMENT_CREATED",
        entityType: "settlement",
        entityId: settlement.id,
        payload: { fromMemberId: input.fromMemberId, toMemberId: input.toMemberId, amountMinor: input.amountMinor, status, method: input.method },
      });
      await notifyGroup(
        tx,
        input.groupId,
        viewer.userId,
        status === "PENDING" ? "SETTLEMENT_CONFIRMATION_REQUESTED" : "SETTLEMENT_RECEIVED",
        { settlementId: settlement.id, amountMinor: input.amountMinor, currency: me.group.currency, by: me.displayName, groupName: me.group.name },
        status === "PENDING" ? [input.toMemberId] : [input.fromMemberId],
      );
      return { settlementId: settlement.id, status };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.settlement.findFirst({
        where: { groupId: input.groupId, idempotencyKey: input.idempotencyKey, createdBy: { userId: viewer.userId } },
        select: { id: true, status: true },
      });
      if (existing) return { settlementId: existing.id, status: existing.status };
    }
    throw error;
  }
}

async function loadPending(tx: Tx, viewer: Viewer, groupId: string, settlementId: string) {
  const me = await requireMember(tx, viewer, groupId);
  assertWritable(me.group);
  await lockGroup(tx, groupId);
  const settlement = await tx.settlement.findFirst({
    where: { id: settlementId, groupId, deletedAt: null },
    include: { to: true, from: true },
  });
  if (!settlement) throw new AppError("NOT_FOUND", "Pagamento não encontrado.");
  return { me, settlement };
}

async function decide(viewer: Viewer, raw: z.input<typeof settlementRefSchema>, decision: "CONFIRMED" | "REJECTED") {
  const input = settlementRefSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const { me, settlement } = await loadPending(tx, viewer, input.groupId, input.settlementId);
    if (settlement.status !== "PENDING") throw new AppError("CONFLICT", "Este pagamento já foi decidido.");
    if (!canDecide(me, settlement.to)) {
      throw new AppError("FORBIDDEN", "Só quem recebeu o pagamento pode confirmá-lo.");
    }
    const updated = await tx.settlement.updateMany({
      where: { id: settlement.id, status: "PENDING", version: settlement.version },
      data: { status: decision, decidedByMemberId: me.id, decidedAt: new Date(), version: { increment: 1 } },
    });
    if (updated.count === 0) throw new AppError("CONFLICT");
    await logActivity(tx, {
      groupId: input.groupId,
      actorMemberId: me.id,
      type: decision === "CONFIRMED" ? "SETTLEMENT_CONFIRMED" : "SETTLEMENT_REJECTED",
      entityType: "settlement",
      entityId: settlement.id,
      payload: { amountMinor: settlement.amountMinor, fromMemberId: settlement.fromMemberId, toMemberId: settlement.toMemberId },
    });
    await notifyGroup(
      tx,
      input.groupId,
      viewer.userId,
      decision === "CONFIRMED" ? "SETTLEMENT_CONFIRMED" : "SETTLEMENT_REJECTED",
      { settlementId: settlement.id, amountMinor: settlement.amountMinor, currency: settlement.currency, by: me.displayName, groupName: me.group.name },
      [settlement.fromMemberId, settlement.createdByMemberId],
    );
  });
}

export const confirmSettlement = (viewer: Viewer, raw: z.input<typeof settlementRefSchema>) => decide(viewer, raw, "CONFIRMED");
export const rejectSettlement = (viewer: Viewer, raw: z.input<typeof settlementRefSchema>) => decide(viewer, raw, "REJECTED");

/** Exclusão lógica: por quem registrou, pelo recebedor ou por um administrador. */
export async function deleteSettlement(viewer: Viewer, raw: z.input<typeof settlementRefSchema>) {
  const input = settlementRefSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const { me, settlement } = await loadPending(tx, viewer, input.groupId, input.settlementId);
    const allowed = settlement.createdByMemberId === me.id || settlement.toMemberId === me.id || me.role === "ADMIN";
    if (!allowed) throw new AppError("FORBIDDEN", "Você não pode excluir este pagamento.");
    await tx.settlement.update({
      where: { id: settlement.id },
      data: { deletedAt: new Date(), deletedByMemberId: me.id, version: { increment: 1 } },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      actorMemberId: me.id,
      type: "SETTLEMENT_DELETED",
      entityType: "settlement",
      entityId: settlement.id,
      payload: { amountMinor: settlement.amountMinor, status: settlement.status, fromMemberId: settlement.fromMemberId, toMemberId: settlement.toMemberId },
    });
  });
}
