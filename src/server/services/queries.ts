import "server-only";
import { normalizeDescription } from "@/lib/category-suggest";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { dbDateToCivil } from "@/schemas/common";
import { computeBalances, pairwiseDebts, type Debt } from "@/server/domain/balance";
import { simplifyDebts } from "@/server/domain/simplify";
import { requireMember } from "./access";
import { loadGroupLedger } from "./ledger";

/**
 * Leituras para as telas. Toda consulta parte das associações ATIVAS do
 * usuário — dados de grupos alheios nunca são carregados.
 */

type MemberBalanceRow = { memberId: string; groupId: string; balance: bigint };

/** Saldo do usuário em cada grupo, numa única consulta agregada. */
async function viewerBalances(userId: string): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<MemberBalanceRow[]>`
    SELECT m.id AS "memberId", m."groupId" AS "groupId",
      COALESCE((SELECT SUM(p."amountMinor") FROM expense_payer p JOIN expense e ON e.id = p."expenseId"
                WHERE p."memberId" = m.id AND e."deletedAt" IS NULL), 0)
    - COALESCE((SELECT SUM(s."amountMinor") FROM expense_split s JOIN expense e ON e.id = s."expenseId"
                WHERE s."memberId" = m.id AND e."deletedAt" IS NULL), 0)
    + COALESCE((SELECT SUM(st."amountMinor") FROM settlement st
                WHERE st."fromMemberId" = m.id AND st."deletedAt" IS NULL AND st.status = 'CONFIRMED'), 0)
    - COALESCE((SELECT SUM(st."amountMinor") FROM settlement st
                WHERE st."toMemberId" = m.id AND st."deletedAt" IS NULL AND st.status = 'CONFIRMED'), 0)
      AS balance
    FROM group_member m
    WHERE m."userId" = ${userId} AND m.status = 'ACTIVE'`;
  return new Map(rows.map((r) => [r.groupId, Number(r.balance)]));
}

export type CurrencyTotals = { currency: string; receivableMinor: number; payableMinor: number; netMinor: number };

export async function getDashboard(viewer: Viewer) {
  const memberships = await db.groupMember.findMany({
    where: { userId: viewer.userId, status: "ACTIVE" },
    select: {
      id: true,
      group: {
        select: {
          id: true,
          name: true,
          category: true,
          currency: true,
          archivedAt: true,
          _count: { select: { members: { where: { status: { in: ["ACTIVE", "PROVISIONAL"] } } } } },
          activity: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      },
    },
  });
  const balances = await viewerBalances(viewer.userId);

  const groups = memberships
    .map((m) => ({
      id: m.group.id,
      name: m.group.name,
      category: m.group.category,
      currency: m.group.currency,
      archived: Boolean(m.group.archivedAt),
      memberCount: m.group._count.members,
      balanceMinor: balances.get(m.group.id) ?? 0,
      lastActivityAt: m.group.activity[0]?.createdAt ?? null,
    }))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0));

  // Totais por moeda — moedas diferentes nunca são somadas.
  const totals = new Map<string, CurrencyTotals>();
  for (const g of groups) {
    const t = totals.get(g.currency) ?? { currency: g.currency, receivableMinor: 0, payableMinor: 0, netMinor: 0 };
    if (g.balanceMinor > 0) t.receivableMinor += g.balanceMinor;
    else t.payableMinor += -g.balanceMinor;
    t.netMinor += g.balanceMinor;
    totals.set(g.currency, t);
  }

  const memberIds = memberships.map((m) => m.id);
  const pendingConfirmations = await db.settlement.count({
    where: { toMemberId: { in: memberIds }, status: "PENDING", deletedAt: null },
  });

  return {
    groups,
    totals: [...totals.values()].sort((a, b) => (a.currency === "BRL" ? -1 : b.currency === "BRL" ? 1 : a.currency.localeCompare(b.currency))),
    pendingConfirmations,
  };
}

export async function getGroupDetail(viewer: Viewer, groupId: string) {
  return db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, groupId);
    // Sequencial: dentro de uma transação há uma única conexão.
    const members = await tx.groupMember.findMany({
        where: { groupId },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true, displayName: true, status: true, role: true, userId: true, email: true, user: { select: { image: true } } },
      });
    const ledger = await loadGroupLedger(tx, groupId);
    const expenses = await tx.expense.findMany({
        where: { groupId, deletedAt: null },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 200,
        select: {
          id: true,
          description: true,
          amountMinor: true,
          currency: true,
          date: true,
          category: true,
          payers: { select: { memberId: true, amountMinor: true } },
          splits: { select: { memberId: true, amountMinor: true } },
        },
      });
    const settlements = await tx.settlement.findMany({
        where: { groupId, deletedAt: null, status: { in: ["PENDING", "CONFIRMED"] } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: { id: true, fromMemberId: true, toMemberId: true, amountMinor: true, date: true, method: true, status: true, note: true, createdByMemberId: true },
      });

    const balances = computeBalances(ledger, members.map((m) => m.id));
    const suggestions: Debt[] = me.group.simplifyDebts ? simplifyDebts(balances) : pairwiseDebts(ledger);
    const memberById = new Map(members.map((m) => [m.id, m]));

    const isAdmin = me.role === "ADMIN";
    return {
      group: {
        id: me.group.id,
        name: me.group.name,
        description: me.group.description,
        category: me.group.category,
        currency: me.group.currency,
        simplifyDebts: me.group.simplifyDebts,
        archived: Boolean(me.group.archivedAt),
      },
      viewer: { memberId: me.id, role: me.role, isAdmin },
      members: members
        .filter((m) => m.status === "ACTIVE" || m.status === "PROVISIONAL" || (balances.get(m.id) ?? 0) !== 0)
        .map((m) => ({
          id: m.id,
          name: m.displayName,
          status: m.status,
          role: m.role,
          imageUrl: m.user?.image ?? null,
          hasEmail: Boolean(m.email),
          isViewer: m.id === me.id,
          balanceMinor: balances.get(m.id) ?? 0,
        })),
      expenses: expenses.map((e) => {
        const paid = e.payers.find((p) => p.memberId === me.id)?.amountMinor ?? 0;
        const owed = e.splits.find((s) => s.memberId === me.id)?.amountMinor ?? 0;
        return {
          id: e.id,
          description: e.description,
          amountMinor: e.amountMinor,
          date: dbDateToCivil(e.date),
          category: e.category,
          payerIds: e.payers.map((p) => p.memberId),
          viewerImpactMinor: paid - owed,
          viewerInvolved: paid > 0 || e.splits.some((s) => s.memberId === me.id),
        };
      }),
      settlements: settlements.map((s) => ({
        ...s,
        date: dbDateToCivil(s.date),
        canDecide:
          s.status === "PENDING" &&
          (s.toMemberId === me.id || (memberById.get(s.toMemberId)?.status === "PROVISIONAL" && isAdmin)),
        canDelete: s.createdByMemberId === me.id || s.toMemberId === me.id || isAdmin,
      })),
      suggestions,
    };
  });
}

/** Membros mínimos para formulários (pagadores/participantes). */
export async function getGroupMembersForForm(viewer: Viewer, groupId: string) {
  return db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, groupId);
    const members = await tx.groupMember.findMany({
      where: { groupId, status: { in: ["ACTIVE", "PROVISIONAL"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true, status: true, user: { select: { image: true } } },
    });
    // Categoria escolhida da última vez para cada descrição (as 200 despesas mais recentes).
    const recent = await tx.expense.findMany({
      where: { groupId, deletedAt: null, category: { not: "OTHER" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { description: true, category: true },
    });
    const categoryHints: Record<string, ExpenseCategory> = {};
    for (const e of recent) categoryHints[normalizeDescription(e.description)] ??= e.category;
    return {
      categoryHints,
      group: { id: me.group.id, name: me.group.name, currency: me.group.currency, archived: Boolean(me.group.archivedAt) },
      viewerMemberId: me.id,
      members: members.map((m) => ({ id: m.id, name: m.displayName, provisional: m.status === "PROVISIONAL", imageUrl: m.user?.image ?? null })),
    };
  });
}

export async function listActivity(viewer: Viewer, options: { groupId?: string; take?: number; before?: Date } = {}) {
  const take = Math.min(options.take ?? 30, 100);
  if (options.groupId) {
    // Valida pertencimento antes de qualquer leitura.
    await db.$transaction((tx) => requireMember(tx, viewer, options.groupId!));
  }
  const items = await db.activityLog.findMany({
    where: {
      group: { members: { some: { userId: viewer.userId, status: "ACTIVE" } } },
      ...(options.groupId ? { groupId: options.groupId } : {}),
      ...(options.before ? { createdAt: { lt: options.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    select: {
      id: true,
      type: true,
      entityType: true,
      entityId: true,
      payload: true,
      createdAt: true,
      groupId: true,
      group: { select: { name: true, currency: true } },
      actor: { select: { id: true, displayName: true, userId: true } },
    },
  });

  // Resolve nomes de membros citados nos payloads (acertos).
  const groupIds = [...new Set(items.map((i) => i.groupId))];
  const names = new Map(
    (await db.groupMember.findMany({ where: { groupId: { in: groupIds } }, select: { id: true, displayName: true, userId: true } })).map((m) => [
      m.id,
      m.userId === viewer.userId ? "você" : m.displayName,
    ]),
  );

  return {
    items: items.slice(0, take).map((i) => ({ ...i, isViewer: i.actor?.userId === viewer.userId })),
    memberNames: Object.fromEntries(names) as Record<string, string>,
    hasMore: items.length > take,
  };
}

export async function listNotifications(viewer: Viewer) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: viewer.userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { userId: viewer.userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markNotificationsRead(viewer: Viewer) {
  await db.notification.updateMany({ where: { userId: viewer.userId, readAt: null }, data: { readAt: new Date() } });
}

export async function assertGroupExistsForViewer(viewer: Viewer, groupId: string) {
  const ok = await db.groupMember.findFirst({ where: { groupId, userId: viewer.userId, status: "ACTIVE" }, select: { id: true } });
  if (!ok) throw new AppError("NOT_FOUND", "Grupo não encontrado.");
}

/**
 * Nomes para o título da página (metadata). Nunca lança: sem sessão, sem
 * acesso ou id inválido → null, e a página usa o título genérico.
 * Mesma regra de acesso das telas: só grupos em que o usuário é membro ativo.
 */
export async function getPageTitles(userId: string, groupId: string, expenseId?: string) {
  const member = await db.groupMember.findFirst({
    where: { groupId, userId, status: "ACTIVE" },
    select: { group: { select: { name: true } } },
  });
  if (!member) return null;
  const expense = expenseId
    ? await db.expense.findFirst({ where: { id: expenseId, groupId }, select: { description: true } })
    : null;
  return { group: member.group.name, expense: expense?.description ?? null };
}
