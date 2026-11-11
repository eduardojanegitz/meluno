import "server-only";
import { z } from "zod";
import type { Viewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { todayInBrazil } from "@/server/domain/recurrence";
import { aggregateSpending, type Period } from "@/server/domain/spending";
import { civilDateToDb, dbDateToCivil, idSchema } from "@/schemas/common";
import { requireMember } from "./access";

export const spendingSchema = z.object({ groupId: idSchema, period: z.enum(["month", "3m", "year", "all"]) });

/** Gastos do grupo no período (aba Gastos). Só para membros. */
export async function getGroupSpending(viewer: Viewer, raw: z.input<typeof spendingSchema>, now = new Date()) {
  const { groupId, period } = spendingSchema.parse(raw);
  const me = await db.$transaction((tx) => requireMember(tx, viewer, groupId));
  const today = todayInBrazil(now);

  const expenses = await db.expense.findMany({
    where: { groupId, deletedAt: null, date: { lte: civilDateToDb(today) } },
    select: {
      date: true,
      amountMinor: true,
      category: true,
      splits: { select: { memberId: true, amountMinor: true } },
      payers: { select: { memberId: true, amountMinor: true } },
    },
  });
  const members = await db.groupMember.findMany({ where: { groupId }, select: { id: true, displayName: true } });

  const spending = aggregateSpending(
    expenses.map((e) => ({ ...e, date: dbDateToCivil(e.date) })),
    period as Period,
    today,
  );
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  return {
    ...spending,
    currency: me.group.currency,
    viewerMemberId: me.id,
    byMember: spending.byMember.map((m) => ({ ...m, name: names.get(m.memberId) ?? "Ex-membro" })),
  };
}

export type GroupSpending = Awaited<ReturnType<typeof getGroupSpending>>;
