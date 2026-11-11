import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Viewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { firstOccurrenceAfter, nextOccurrence, todayInBrazil } from "@/server/domain/recurrence";
import { scheduleDelivery } from "@/server/notifications/deliver";
import { civilDateToDb, dbDateToCivil, idSchema } from "@/schemas/common";
import type { createExpenseSchema } from "@/schemas/expense";
import { requireMember } from "./access";
import { createExpense } from "./expenses";

const MAX_CATCH_UP = 12; // no máximo 12 ocorrências atrasadas por execução e por modelo
const BATCH = 200;

/** Id da ocorrência derivado de (modelo, data): rodar duas vezes não duplica. */
export function occurrenceId(templateId: string, date: string): string {
  const h = createHash("sha256").update(`${templateId}:${date}`).digest("hex");
  // Formato de UUID (versão 8 = "personalizado", variante RFC 4122).
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Gera as ocorrências vencidas (chamado pelo agendador diário).
 * Cada ocorrência passa pelo mesmo `createExpense` do formulário: mesmas validações,
 * histórico e notificações. Se algo impedir (alguém da divisão saiu, grupo arquivado,
 * quem criou saiu), o modelo é pausado e quem o criou é avisado.
 */
export async function generateDueRecurring(now = new Date()) {
  const today = todayInBrazil(now);
  const due = await db.recurringExpense.findMany({
    where: { status: "ACTIVE", deletedAt: null, nextDate: { lte: civilDateToDb(today) } },
    orderBy: { nextDate: "asc" },
    take: BATCH,
    select: {
      id: true,
      groupId: true,
      description: true,
      amountMinor: true,
      category: true,
      notes: true,
      payers: true,
      split: true,
      frequency: true,
      anchorDay: true,
      nextDate: true,
      createdBy: { select: { id: true, status: true, displayName: true, user: { select: { id: true, name: true, email: true } } } },
    },
  });

  let created = 0;
  let paused = 0;
  for (const t of due) {
    const creator = t.createdBy.user;
    if (!creator || t.createdBy.status !== "ACTIVE") {
      await pause(t.id, t.groupId, null, t.description, "Quem criou a recorrência não está mais no grupo.");
      paused++;
      continue;
    }
    const viewer: Viewer = { userId: creator.id, name: creator.name, email: creator.email };
    let date = dbDateToCivil(t.nextDate);
    for (let i = 0; i < MAX_CATCH_UP && date <= today; i++) {
      const input: z.input<typeof createExpenseSchema> = {
        groupId: t.groupId,
        expenseId: occurrenceId(t.id, date),
        description: t.description,
        amountMinor: t.amountMinor,
        date,
        category: t.category,
        notes: t.notes ?? undefined,
        payers: t.payers as z.input<typeof createExpenseSchema>["payers"],
        split: t.split as z.input<typeof createExpenseSchema>["split"],
      };
      try {
        const r = await createExpense(viewer, input, { recurringExpenseId: t.id });
        if (!r.duplicate) created++;
      } catch (error) {
        // Mesma data já gerada (corrida entre execuções): segue para a próxima.
        const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!duplicate) {
          const reason = error instanceof AppError ? reasonFor(error) : null;
          if (!reason) throw error;
          await pause(t.id, t.groupId, creator.id, t.description, reason);
          paused++;
          break;
        }
      }
      date = nextOccurrence(date, t.frequency, t.anchorDay);
      await db.recurringExpense.update({ where: { id: t.id }, data: { nextDate: civilDateToDb(date) } });
    }
  }
  logger.info("recurring.done", { due: due.length, created, paused });
  return { due: due.length, created, paused, more: due.length === BATCH };
}

function reasonFor(error: AppError): string | null {
  if (error.code === "FORBIDDEN") return "O grupo foi arquivado ou não aceita mais despesas.";
  if (error.code === "VALIDATION" || error.code === "NOT_FOUND") return "Alguém da divisão saiu do grupo. Edite a despesa e crie a recorrência de novo.";
  return null;
}

async function pause(id: string, groupId: string, notifyUserId: string | null, description: string, reason: string) {
  await db.recurringExpense.update({ where: { id }, data: { status: "PAUSED", pausedReason: reason } });
  if (notifyUserId) {
    const group = await db.group.findUnique({ where: { id: groupId }, select: { name: true } });
    const n = await db.notification.create({
      data: { userId: notifyUserId, type: "RECURRING_PAUSED", groupId, payload: { description, reason, groupName: group?.name ?? "" } },
      select: { id: true },
    });
    scheduleDelivery([n.id]);
  }
}

// ——— Gerenciamento (configurações do grupo) ———

export async function listRecurring(viewer: Viewer, groupId: string) {
  return db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, groupId);
    const items = await tx.recurringExpense.findMany({
      where: { groupId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, description: true, amountMinor: true, frequency: true, nextDate: true, status: true, pausedReason: true, createdByMemberId: true, createdBy: { select: { displayName: true } } },
    });
    return items.map((r) => ({
      ...r,
      nextDate: dbDateToCivil(r.nextDate),
      createdByName: r.createdBy.displayName,
      canManage: !me.group.archivedAt && me.status === "ACTIVE" && (me.role === "ADMIN" || r.createdByMemberId === me.id),
    }));
  });
}

export const recurringRefSchema = z.object({ groupId: idSchema, recurringId: idSchema });
export const recurringActionSchema = recurringRefSchema.extend({ action: z.enum(["pause", "resume", "delete"]) });

/** Pausar, retomar (pulando as datas perdidas) ou excluir: quem criou ou um administrador. */
export async function manageRecurring(viewer: Viewer, raw: z.input<typeof recurringActionSchema>, now = new Date()) {
  const input = recurringActionSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, input.groupId);
    const r = await tx.recurringExpense.findFirst({ where: { id: input.recurringId, groupId: input.groupId, deletedAt: null } });
    if (!r) throw new AppError("NOT_FOUND", "Recorrência não encontrada.");
    if (me.status !== "ACTIVE" || (me.role !== "ADMIN" && r.createdByMemberId !== me.id)) {
      throw new AppError("FORBIDDEN", "Só quem criou a recorrência ou um administrador pode alterá-la.");
    }
    if (input.action === "delete") {
      // Despesas já lançadas continuam; só param as próximas.
      await tx.recurringExpense.update({ where: { id: r.id }, data: { deletedAt: new Date(), status: "PAUSED", pausedReason: "Excluída." } });
    } else if (input.action === "pause") {
      await tx.recurringExpense.update({ where: { id: r.id }, data: { status: "PAUSED", pausedReason: `Pausada por ${me.displayName}.` } });
    } else {
      if (me.group.archivedAt) throw new AppError("FORBIDDEN", "Este grupo está arquivado.");
      const next = firstOccurrenceAfter(dbDateToCivil(r.nextDate), todayInBrazil(now), r.frequency, r.anchorDay);
      // Se a próxima data ainda é futura, mantém; se passou, pula para a primeira depois de hoje.
      const keep = dbDateToCivil(r.nextDate) > todayInBrazil(now);
      await tx.recurringExpense.update({ where: { id: r.id }, data: { status: "ACTIVE", pausedReason: null, nextDate: keep ? r.nextDate : civilDateToDb(next) } });
    }
  });
}
