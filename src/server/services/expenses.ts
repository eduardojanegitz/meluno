import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { civilDateToDb, dbDateToCivil } from "@/schemas/common";
import { createExpenseSchema, expenseRefSchema, updateExpenseSchema } from "@/schemas/expense";
import { computeSplit, PayerError, SplitError, validatePayers, type SplitRequest } from "@/server/domain/split";
import { MoneyError } from "@/server/domain/money";
import { assertGroupMembers, assertWritable, lockGroup, requireMember, type Tx } from "./access";
import { logActivity, notifyGroup } from "./activity";

type ExpenseCore = z.output<typeof createExpenseSchema>;

/** Converte erros do domínio em mensagens de validação para o usuário. */
function computeFinancials(input: Pick<ExpenseCore, "amountMinor" | "payers" | "split">, seed: string) {
  try {
    const payers = validatePayers(input.amountMinor, input.payers);
    const request = {
      method: input.split.method,
      entries: input.split.entries.map((e) => ({ memberId: e.memberId, value: e.value ?? 0 })),
    } as SplitRequest;
    const splits = computeSplit(input.amountMinor, request, seed);
    return { payers, splits };
  } catch (error) {
    if (error instanceof SplitError || error instanceof PayerError || error instanceof MoneyError) {
      throw new AppError("VALIDATION", error.message, { [error instanceof PayerError ? "payers" : "split"]: error.message });
    }
    throw error;
  }
}

const expenseInclude = {
  payers: { select: { memberId: true, amountMinor: true } },
  splits: { select: { memberId: true, amountMinor: true, inputValue: true } },
} as const;

type ExpenseWithParts = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

/** Retrato completo para o histórico (permite reconstruir qualquer versão). */
function snapshot(e: ExpenseWithParts) {
  return {
    description: e.description,
    amountMinor: e.amountMinor,
    currency: e.currency,
    date: dbDateToCivil(e.date),
    category: e.category,
    splitMethod: e.splitMethod,
    notes: e.notes,
    version: e.version,
    payers: e.payers.map((p) => ({ memberId: p.memberId, amountMinor: p.amountMinor })),
    splits: e.splits.map((s) => ({ memberId: s.memberId, amountMinor: s.amountMinor, inputValue: s.inputValue })),
  };
}

export async function createExpense(viewer: Viewer, raw: z.input<typeof createExpenseSchema>) {
  const input = createExpenseSchema.parse(raw);
  // O id (gerado no cliente) é a semente determinística do arredondamento.
  const { expenseId } = input;
  const { payers, splits } = computeFinancials(input, expenseId);

  try {
    return await db.$transaction(async (tx) => {
      const me = await requireMember(tx, viewer, input.groupId);
      assertWritable(me.group);
      await lockGroup(tx, input.groupId);

      // Reenvio do mesmo formulário: devolve a despesa já criada.
      const existing = await tx.expense.findUnique({ where: { id: expenseId }, select: { id: true, createdByMemberId: true } });
      if (existing) {
        if (existing.createdByMemberId !== me.id) throw new AppError("CONFLICT", "Não foi possível salvar. Tente novamente.");
        return { expenseId: existing.id, duplicate: true };
      }

      await assertGroupMembers(tx, input.groupId, [...payers.map((p) => p.memberId), ...splits.map((s) => s.memberId)]);

      const expense = await tx.expense.create({
        data: {
          id: expenseId,
          groupId: input.groupId,
          description: input.description,
          amountMinor: input.amountMinor,
          currency: me.group.currency,
          date: civilDateToDb(input.date),
          category: input.category,
          splitMethod: input.split.method,
          notes: input.notes,
          idempotencyKey: expenseId,
          createdByMemberId: me.id,
          payers: { create: payers.map((p) => ({ memberId: p.memberId, amountMinor: p.amountMinor })) },
          splits: { create: splits.map((s) => ({ memberId: s.memberId, amountMinor: s.amountMinor, inputValue: s.inputValue })) },
        },
        include: expenseInclude,
      });

      await logActivity(tx, {
        groupId: input.groupId,
        actorMemberId: me.id,
        type: "EXPENSE_CREATED",
        entityType: "expense",
        entityId: expense.id,
        payload: { after: snapshot(expense) },
      });
      await notifyGroup(
        tx,
        input.groupId,
        viewer.userId,
        "EXPENSE_ADDED",
        { expenseId: expense.id, description: expense.description, amountMinor: expense.amountMinor, currency: expense.currency, by: me.displayName, groupName: me.group.name },
        [...new Set([...payers.map((p) => p.memberId), ...splits.map((s) => s.memberId)])],
      );
      return { expenseId: expense.id, duplicate: false };
    });
  } catch (error) {
    // Corrida entre dois envios idênticos simultâneos: o segundo esbarra no índice único.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.expense.findFirst({
        where: { id: expenseId, groupId: input.groupId, createdBy: { userId: viewer.userId } },
        select: { id: true },
      });
      if (existing) return { expenseId: existing.id, duplicate: true };
    }
    throw error;
  }
}

async function loadEditable(tx: Tx, viewer: Viewer, groupId: string, expenseId: string) {
  const me = await requireMember(tx, viewer, groupId);
  const expense = await tx.expense.findFirst({ where: { id: expenseId, groupId }, include: expenseInclude });
  if (!expense) throw new AppError("NOT_FOUND", "Despesa não encontrada.");
  if (expense.createdByMemberId !== me.id && me.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Só quem registrou a despesa ou um administrador pode alterá-la.");
  }
  return { me, expense };
}

export async function updateExpense(viewer: Viewer, raw: z.input<typeof updateExpenseSchema>) {
  const input = updateExpenseSchema.parse(raw);
  const { payers, splits } = computeFinancials(input, input.expenseId);

  return db.$transaction(async (tx) => {
    const { me, expense } = await loadEditable(tx, viewer, input.groupId, input.expenseId);
    assertWritable(me.group);
    if (expense.deletedAt) throw new AppError("VALIDATION", "Restaure a despesa antes de editá-la.");
    await lockGroup(tx, input.groupId);

    const previousIds = new Set([...expense.payers.map((p) => p.memberId), ...expense.splits.map((s) => s.memberId)]);
    await assertGroupMembers(tx, input.groupId, [...payers.map((p) => p.memberId), ...splits.map((s) => s.memberId)], previousIds);

    // Lock otimista: só grava se ninguém alterou desde que o usuário abriu a edição.
    const updated = await tx.expense.updateMany({
      where: { id: expense.id, version: input.version, deletedAt: null },
      data: {
        description: input.description,
        amountMinor: input.amountMinor,
        date: civilDateToDb(input.date),
        category: input.category,
        splitMethod: input.split.method,
        notes: input.notes ?? null,
        updatedByMemberId: me.id,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new AppError("CONFLICT", "Esta despesa foi alterada por outra pessoa. Recarregue para ver a versão atual.");

    await tx.expensePayer.deleteMany({ where: { expenseId: expense.id } });
    await tx.expenseSplit.deleteMany({ where: { expenseId: expense.id } });
    await tx.expensePayer.createMany({ data: payers.map((p) => ({ expenseId: expense.id, memberId: p.memberId, amountMinor: p.amountMinor })) });
    await tx.expenseSplit.createMany({
      data: splits.map((s) => ({ expenseId: expense.id, memberId: s.memberId, amountMinor: s.amountMinor, inputValue: s.inputValue })),
    });

    const after = await tx.expense.findUniqueOrThrow({ where: { id: expense.id }, include: expenseInclude });
    await logActivity(tx, {
      groupId: input.groupId,
      actorMemberId: me.id,
      type: "EXPENSE_UPDATED",
      entityType: "expense",
      entityId: expense.id,
      payload: { before: snapshot(expense), after: snapshot(after) },
    });
    await notifyGroup(
      tx,
      input.groupId,
      viewer.userId,
      "EXPENSE_UPDATED",
      { expenseId: expense.id, description: after.description, by: me.displayName, groupName: me.group.name },
      [...new Set([...previousIds, ...payers.map((p) => p.memberId), ...splits.map((s) => s.memberId)])],
    );
    return { expenseId: expense.id, version: after.version };
  });
}

export async function deleteExpense(viewer: Viewer, raw: z.input<typeof expenseRefSchema>) {
  const input = expenseRefSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const { me, expense } = await loadEditable(tx, viewer, input.groupId, input.expenseId);
    assertWritable(me.group);
    if (expense.deletedAt) return;
    await lockGroup(tx, input.groupId);
    await tx.expense.update({
      where: { id: expense.id },
      data: { deletedAt: new Date(), deletedByMemberId: me.id, version: { increment: 1 } },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      actorMemberId: me.id,
      type: "EXPENSE_DELETED",
      entityType: "expense",
      entityId: expense.id,
      payload: { before: snapshot(expense) },
    });
    await notifyGroup(
      tx,
      input.groupId,
      viewer.userId,
      "EXPENSE_DELETED",
      { expenseId: expense.id, description: expense.description, by: me.displayName, groupName: me.group.name },
      [...new Set([...expense.payers.map((p) => p.memberId), ...expense.splits.map((s) => s.memberId)])],
    );
  });
}

export async function restoreExpense(viewer: Viewer, raw: z.input<typeof expenseRefSchema>) {
  const input = expenseRefSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const { me, expense } = await loadEditable(tx, viewer, input.groupId, input.expenseId);
    assertWritable(me.group);
    if (!expense.deletedAt) return;
    await lockGroup(tx, input.groupId);
    await tx.expense.update({
      where: { id: expense.id },
      data: { deletedAt: null, deletedByMemberId: null, version: { increment: 1 } },
    });
    await logActivity(tx, { groupId: input.groupId, actorMemberId: me.id, type: "EXPENSE_RESTORED", entityType: "expense", entityId: expense.id, payload: { after: snapshot(expense) } });
  });
}

/** Detalhe de uma despesa, com permissões calculadas para a UI. */
export async function getExpense(viewer: Viewer, groupId: string, expenseId: string) {
  return db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, groupId);
    const expense = await tx.expense.findFirst({
      where: { id: expenseId, groupId },
      include: {
        ...expenseInclude,
        createdBy: { select: { id: true, displayName: true } },
        updatedBy: { select: { displayName: true } },
      },
    });
    if (!expense) throw new AppError("NOT_FOUND", "Despesa não encontrada.");
    const history = await tx.activityLog.findMany({
      where: { groupId, entityType: "expense", entityId: expenseId },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, createdAt: true, payload: true, actor: { select: { displayName: true } } },
    });
    return {
      expense: { ...expense, date: dbDateToCivil(expense.date) },
      history,
      canEdit: !me.group.archivedAt && (expense.createdByMemberId === me.id || me.role === "ADMIN"),
      viewerMemberId: me.id,
    };
  });
}
