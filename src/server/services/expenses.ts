import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { civilDateToDb, dbDateToCivil } from "@/schemas/common";
import { createExpenseSchema, expenseRefSchema, updateExpenseSchema } from "@/schemas/expense";
import { computeItemSplit, computeSplit, PayerError, SplitError, validatePayers, type SplitRequest } from "@/server/domain/split";
import { MoneyError } from "@/server/domain/money";
import { nextOccurrence } from "@/server/domain/recurrence";
import { convertMinor, formatRate, FxError, parseRate } from "@/server/domain/fx";
import { assertGroupMembers, assertWritable, lockGroup, requireMember, type Tx } from "./access";
import { logActivity, notifyGroup } from "./activity";

type ExpenseCore = z.output<typeof createExpenseSchema>;

/** Converte erros do domínio em mensagens de validação para o usuário. */
function computeFinancials(input: Pick<ExpenseCore, "amountMinor" | "payers" | "split">, seed: string) {
  try {
    const payers = validatePayers(input.amountMinor, input.payers);
    if (input.split.method === "ITEMS") {
      const items = input.split.items ?? [];
      const result = computeItemSplit({ items, serviceBp: input.split.serviceBp ?? 0, feesMinor: input.split.feesMinor ?? 0 }, seed);
      // O total vem da soma dos itens + serviço + taxas; o cliente precisa ter mandado o mesmo valor.
      if (result.totalMinor !== input.amountMinor) {
        throw new SplitError("EXACT_SUM_MISMATCH", "O total não bate com a soma dos itens, serviço e taxas.", result.totalMinor - input.amountMinor);
      }
      return {
        payers,
        splits: result.shares,
        items: { list: items, serviceBp: input.split.serviceBp ?? 0, feesMinor: input.split.feesMinor ?? 0 },
      };
    }
    const request = {
      method: input.split.method,
      entries: input.split.entries.map((e) => ({ memberId: e.memberId, value: e.value ?? 0 })),
    } as SplitRequest;
    const splits = computeSplit(input.amountMinor, request, seed);
    return { payers, splits, items: null };
  } catch (error) {
    if (error instanceof SplitError || error instanceof PayerError || error instanceof MoneyError) {
      throw new AppError("VALIDATION", error.message, { [error instanceof PayerError ? "payers" : "split"]: error.message });
    }
    throw error;
  }
}

/**
 * Outra moeda: confere a cotação e recalcula o convertido. O valor que entra nos saldos é o
 * convertido (moeda do grupo); se o cliente mandou outro, a despesa é recusada.
 */
function resolveForeign(input: { amountMinor: number; split: { method: string }; foreign?: { currency: string; amountMinor: number; rate: string } }, groupCurrency: string) {
  const f = input.foreign;
  if (!f) return { originalCurrency: null, originalAmountMinor: null, exchangeRateE10: null };
  if (f.currency === groupCurrency) throw new AppError("VALIDATION", "Escolha uma moeda diferente da do grupo.", { foreign: "Moeda igual à do grupo." });
  if (input.split.method === "ITEMS") throw new AppError("VALIDATION", "Divisão por item só na moeda do grupo.", { foreign: "Divisão por item só na moeda do grupo." });
  try {
    const rate = parseRate(f.rate);
    const converted = convertMinor(f.amountMinor, f.currency, groupCurrency, rate);
    if (converted !== input.amountMinor) throw new AppError("VALIDATION", "O valor convertido não confere com a cotação.", { foreign: "Valor convertido não confere." });
    return { originalCurrency: f.currency, originalAmountMinor: f.amountMinor, exchangeRateE10: rate };
  } catch (error) {
    if (error instanceof FxError) throw new AppError("VALIDATION", error.message, { foreign: error.message });
    throw error;
  }
}

const expenseInclude = {
  payers: { select: { memberId: true, amountMinor: true } },
  splits: { select: { memberId: true, amountMinor: true, inputValue: true } },
  items: { orderBy: { position: "asc" }, select: { description: true, amountMinor: true, members: { select: { memberId: true } } } },
} as const;

type ItemsData = { list: { description: string; amountMinor: number; memberIds: string[] }[]; serviceBp: number; feesMinor: number } | null;

const itemsCreate = (items: ItemsData) =>
  items
    ? {
        create: items.list.map((it, position) => ({
          position,
          description: it.description,
          amountMinor: it.amountMinor,
          members: { create: it.memberIds.map((memberId) => ({ memberId })) },
        })),
      }
    : undefined;

type ExpenseWithParts = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;
type ExpenseRow = Prisma.ExpenseGetPayload<object>;

/**
 * Carrega pagadores, divisões e itens **uma consulta por vez**.
 * Com `include` de várias relações o Prisma 7 dispara as consultas em paralelo; dentro de
 * uma transação (uma única conexão) isso gera o aviso do `pg` que vira erro no pg@9.
 */
async function withParts<E extends ExpenseRow>(tx: Tx, expense: E): Promise<E & Pick<ExpenseWithParts, "payers" | "splits" | "items">> {
  const where = { expenseId: expense.id };
  const payers = await tx.expensePayer.findMany({ where, select: expenseInclude.payers.select });
  const splits = await tx.expenseSplit.findMany({ where, select: expenseInclude.splits.select });
  const items = await tx.expenseItem.findMany({ where, orderBy: expenseInclude.items.orderBy, select: expenseInclude.items.select });
  return { ...expense, payers, splits, items };
}

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
    ...(e.originalCurrency
      ? { originalCurrency: e.originalCurrency, originalAmountMinor: e.originalAmountMinor, exchangeRate: e.exchangeRateE10 !== null ? formatRate(e.exchangeRateE10) : null }
      : {}),
    ...(e.splitMethod === "ITEMS"
      ? {
          serviceBp: e.serviceBp,
          feesMinor: e.feesMinor,
          items: e.items.map((i) => ({ description: i.description, amountMinor: i.amountMinor, memberIds: i.members.map((m) => m.memberId) })),
        }
      : {}),
  };
}

/** `recurringExpenseId`: uso interno do agendador, ao gerar uma ocorrência. */
export async function createExpense(viewer: Viewer, raw: z.input<typeof createExpenseSchema>, opts: { recurringExpenseId?: string } = {}) {
  const input = createExpenseSchema.parse(raw);
  // O id (gerado no cliente) é a semente determinística do arredondamento.
  const { expenseId } = input;
  const { payers, splits, items } = computeFinancials(input, expenseId);

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
      const foreign = resolveForeign(input, me.group.currency);

      // "Repetir": o modelo guarda pagadores e divisão como vieram; esta é a 1ª ocorrência.
      let recurringExpenseId = opts.recurringExpenseId;
      if (input.repeat && !recurringExpenseId) {
        const anchorDay = Number(input.date.slice(8, 10));
        const template = await tx.recurringExpense.create({
          data: {
            groupId: input.groupId,
            createdByMemberId: me.id,
            description: input.description,
            amountMinor: input.amountMinor,
            category: input.category,
            notes: input.notes,
            payers: input.payers,
            split: input.split,
            frequency: input.repeat,
            anchorDay,
            nextDate: civilDateToDb(nextOccurrence(input.date, input.repeat, anchorDay)),
          },
          select: { id: true },
        });
        recurringExpenseId = template.id;
      }

      const created = await tx.expense.create({
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
          recurringExpenseId,
          payers: { create: payers.map((p) => ({ memberId: p.memberId, amountMinor: p.amountMinor })) },
          splits: { create: splits.map((s) => ({ memberId: s.memberId, amountMinor: s.amountMinor, inputValue: s.inputValue })) },
          serviceBp: items?.serviceBp ?? null,
          feesMinor: items?.feesMinor ?? null,
          ...foreign,
          items: itemsCreate(items),
        },
      });
      const expense = await withParts(tx, created);

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
  const row = await tx.expense.findFirst({ where: { id: expenseId, groupId } });
  if (!row) throw new AppError("NOT_FOUND", "Despesa não encontrada.");
  const expense = await withParts(tx, row);
  if (expense.createdByMemberId !== me.id && me.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Só quem registrou a despesa ou um administrador pode alterá-la.");
  }
  return { me, expense };
}

export async function updateExpense(viewer: Viewer, raw: z.input<typeof updateExpenseSchema>) {
  const input = updateExpenseSchema.parse(raw);
  const { payers, splits, items } = computeFinancials(input, input.expenseId);

  return db.$transaction(async (tx) => {
    const { me, expense } = await loadEditable(tx, viewer, input.groupId, input.expenseId);
    assertWritable(me.group);
    if (expense.deletedAt) throw new AppError("VALIDATION", "Restaure a despesa antes de editá-la.");
    await lockGroup(tx, input.groupId);

    const previousIds = new Set([...expense.payers.map((p) => p.memberId), ...expense.splits.map((s) => s.memberId)]);
    await assertGroupMembers(tx, input.groupId, [...payers.map((p) => p.memberId), ...splits.map((s) => s.memberId)], previousIds);
    const foreign = resolveForeign(input, me.group.currency);

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
        serviceBp: items?.serviceBp ?? null,
        feesMinor: items?.feesMinor ?? null,
        ...foreign,
        updatedByMemberId: me.id,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new AppError("CONFLICT", "Esta despesa foi alterada por outra pessoa. Recarregue para ver a versão atual.");

    await tx.expensePayer.deleteMany({ where: { expenseId: expense.id } });
    await tx.expenseSplit.deleteMany({ where: { expenseId: expense.id } });
    await tx.expenseItem.deleteMany({ where: { expenseId: expense.id } });
    if (items) await tx.expense.update({ where: { id: expense.id }, data: { items: itemsCreate(items) } });
    await tx.expensePayer.createMany({ data: payers.map((p) => ({ expenseId: expense.id, memberId: p.memberId, amountMinor: p.amountMinor })) });
    await tx.expenseSplit.createMany({
      data: splits.map((s) => ({ expenseId: expense.id, memberId: s.memberId, amountMinor: s.amountMinor, inputValue: s.inputValue })),
    });

    const after = await withParts(tx, await tx.expense.findUniqueOrThrow({ where: { id: expense.id } }));
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
    const row = await tx.expense.findFirst({ where: { id: expenseId, groupId } });
    if (!row) throw new AppError("NOT_FOUND", "Despesa não encontrada.");
    const createdBy = await tx.groupMember.findUniqueOrThrow({ where: { id: row.createdByMemberId }, select: { id: true, displayName: true } });
    const updatedBy = row.updatedByMemberId ? await tx.groupMember.findUnique({ where: { id: row.updatedByMemberId }, select: { displayName: true } }) : null;
    const expense = { ...(await withParts(tx, row)), createdBy, updatedBy };
    const history = await tx.activityLog.findMany({
      where: { groupId, entityType: "expense", entityId: expenseId },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, createdAt: true, payload: true, actor: { select: { displayName: true } } },
    });
    const receipt = await tx.expenseReceipt.findUnique({ where: { expenseId }, select: { createdAt: true, sizeBytes: true } });
    const recurring = expense.recurringExpenseId
      ? await tx.recurringExpense.findFirst({ where: { id: expense.recurringExpenseId, deletedAt: null }, select: { frequency: true, status: true } })
      : null;
    const writable = !me.group.archivedAt && me.status === "ACTIVE";
    const { exchangeRateE10, originalCurrency, originalAmountMinor, ...rest } = expense;
    return {
      expense: {
        ...rest,
        date: dbDateToCivil(expense.date),
        foreign:
          originalCurrency && originalAmountMinor !== null && exchangeRateE10 !== null
            ? { currency: originalCurrency, amountMinor: originalAmountMinor, rate: formatRate(exchangeRateE10) }
            : null,
      },
      history,
      canEdit: writable && (expense.createdByMemberId === me.id || me.role === "ADMIN"),
      // Comprovante: quem lançou, quem pagou ou um administrador (mesma regra de services/receipts.ts).
      canManageReceipt: writable && (expense.createdByMemberId === me.id || me.role === "ADMIN" || expense.payers.some((p) => p.memberId === me.id)),
      receipt,
      recurring,
      viewerMemberId: me.id,
    };
  });
}
