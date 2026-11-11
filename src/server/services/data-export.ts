import "server-only";
import type { Viewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { dbDateToCivil } from "@/schemas/common";

/**
 * Exportação dos dados pessoais (LGPD, art. 18, V: portabilidade). ADR 0009.
 *
 * Entra o que é da pessoa ou sobre ela: conta, formas de login (sem senhas nem tokens),
 * sessões, preferências, chaves Pix, participações em grupos, a parte dela em cada
 * despesa, os acertos em que ela está e as notificações.
 * De outras pessoas, só o nome de exibição necessário para entender o registro
 * (quem recebeu um acerto, por exemplo). Não entram as partes de outras pessoas.
 */
export async function exportMyData(viewer: Viewer) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: viewer.userId },
    select: { name: true, email: true, emailVerified: true, image: true, createdAt: true, updatedAt: true },
  });
  const accounts = await db.account.findMany({ where: { userId: viewer.userId }, select: { providerId: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const sessions = await db.session.findMany({
    where: { userId: viewer.userId },
    select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    orderBy: { createdAt: "desc" },
  });
  const preferences = await db.userPreferences.findUnique({
    where: { userId: viewer.userId },
    select: { defaultCurrency: true, emailOnExpense: true, emailOnSettlement: true, emailOnInvitation: true, pixCity: true, updatedAt: true },
  });
  const pixKeys = await db.pixKey.findMany({ where: { userId: viewer.userId }, select: { type: true, value: true, label: true, isDefault: true, createdAt: true } });
  const memberships = await db.groupMember.findMany({
    where: { userId: viewer.userId },
    select: { id: true, displayName: true, role: true, status: true, joinedAt: true, leftAt: true, group: { select: { name: true, currency: true, archivedAt: true } } },
    orderBy: { createdAt: "asc" },
  });

  const groups = [];
  for (const m of memberships) {
    const expenses = await db.expense.findMany({
      where: { OR: [{ payers: { some: { memberId: m.id } } }, { splits: { some: { memberId: m.id } } }], deletedAt: null },
      select: {
        description: true,
        date: true,
        amountMinor: true,
        currency: true,
        category: true,
        splitMethod: true,
        notes: true,
        createdByMemberId: true,
        createdAt: true,
        payers: { where: { memberId: m.id }, select: { amountMinor: true } },
        splits: { where: { memberId: m.id }, select: { amountMinor: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    const settlements = await db.settlement.findMany({
      where: { OR: [{ fromMemberId: m.id }, { toMemberId: m.id }], deletedAt: null },
      select: {
        date: true,
        amountMinor: true,
        currency: true,
        method: true,
        note: true,
        status: true,
        fromMemberId: true,
        from: { select: { displayName: true } },
        to: { select: { displayName: true } },
        createdAt: true,
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    groups.push({
      group: m.group.name,
      currency: m.group.currency,
      groupArchived: m.group.archivedAt !== null,
      displayName: m.displayName,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
      expenses: expenses.map((e) => ({
        description: e.description,
        date: dbDateToCivil(e.date),
        totalMinor: e.amountMinor,
        currency: e.currency,
        category: e.category,
        splitMethod: e.splitMethod,
        notes: e.notes,
        createdByYou: e.createdByMemberId === m.id,
        youPaidMinor: e.payers.reduce((s, p) => s + p.amountMinor, 0),
        yourShareMinor: e.splits.reduce((s, p) => s + p.amountMinor, 0),
        createdAt: e.createdAt,
      })),
      settlements: settlements.map((s) => ({
        direction: s.fromMemberId === m.id ? "paid" : "received",
        counterpart: s.fromMemberId === m.id ? s.to.displayName : s.from.displayName,
        date: dbDateToCivil(s.date),
        amountMinor: s.amountMinor,
        currency: s.currency,
        method: s.method,
        note: s.note,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  }

  const notifications = await db.notification.findMany({
    where: { userId: viewer.userId },
    select: { type: true, payload: true, readAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    format: "meluno-export",
    version: 1,
    exportedAt: new Date(),
    notes: [
      "Valores em centavos (amountMinor). Datas de despesas e acertos no formato AAAA-MM-DD.",
      "Senhas, tokens e dados de outras pessoas não são incluídos, exceto o nome de exibição necessário para entender um registro.",
    ],
    account: { ...user, loginMethods: accounts.map((a) => ({ method: a.providerId === "credential" ? "email-senha" : a.providerId, since: a.createdAt })) },
    sessions,
    preferences,
    pixKeys,
    groups,
    notifications,
  };
}
