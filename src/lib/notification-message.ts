import { formatMoney } from "@/lib/format";

/**
 * Texto puro de uma notificação (push e e-mail). A tela de Atividade usa a mesma
 * redação, com componentes; mantenha as duas em sintonia.
 */
export type NotificationPayload = {
  by?: string;
  groupName?: string;
  description?: string;
  amountMinor?: number;
  currency?: string;
  name?: string;
};

export type NotificationMessage = { title: string; body: string; path: string };

export function notificationMessage(type: string, payload: NotificationPayload, groupId: string | null): NotificationMessage {
  const p = payload ?? {};
  const amount = typeof p.amountMinor === "number" ? formatMoney(p.amountMinor, { currency: p.currency ?? "BRL" }) : "";
  const title = p.groupName || "Meluno";
  const group = groupId ? `/grupos/${groupId}` : "/inicio";
  const balances = groupId ? `/grupos/${groupId}?aba=saldos` : "/inicio";

  switch (type) {
    case "EXPENSE_ADDED":
      return { title, body: `${p.by} adicionou “${p.description}”${amount ? ` · ${amount}` : ""}`, path: group };
    case "EXPENSE_UPDATED":
      return { title, body: `${p.by} alterou “${p.description}”`, path: group };
    case "EXPENSE_DELETED":
      return { title, body: `${p.by} excluiu “${p.description}”`, path: group };
    case "INVITATION_RECEIVED":
      return { title: "Novo convite", body: `${p.by} convidou você para “${p.groupName}”`, path: "/convites" };
    case "SETTLEMENT_RECEIVED":
      return { title, body: `${p.by} registrou que você pagou ${amount}`, path: balances };
    case "SETTLEMENT_CONFIRMATION_REQUESTED":
      return { title, body: `${p.by} informou um pagamento de ${amount} para você. Confirme se recebeu.`, path: balances };
    case "SETTLEMENT_CONFIRMED":
      return { title, body: `${p.by} confirmou o recebimento de ${amount}`, path: balances };
    case "SETTLEMENT_REJECTED":
      return { title, body: `${p.by} não reconheceu um pagamento de ${amount}`, path: balances };
    case "MEMBER_JOINED":
      return { title, body: `${p.name} entrou em “${p.groupName}”`, path: group };
    case "PAYMENT_REMINDER":
      return { title, body: `${p.by} lembrou você do acerto de ${amount} em “${p.groupName}”`, path: balances };
    default:
      return { title, body: `Atualização em “${p.groupName ?? "um grupo"}”`, path: group };
  }
}

/** Qual preferência de e-mail cobre cada tipo (null = não manda e-mail por aqui). */
export function emailPreferenceFor(type: string): "emailOnExpense" | "emailOnSettlement" | null {
  if (type === "EXPENSE_ADDED") return "emailOnExpense";
  if (type === "SETTLEMENT_RECEIVED" || type === "SETTLEMENT_CONFIRMATION_REQUESTED" || type === "SETTLEMENT_CONFIRMED" || type === "SETTLEMENT_REJECTED") return "emailOnSettlement";
  // Convites e lembretes já mandam o próprio e-mail no fluxo de origem.
  return null;
}
