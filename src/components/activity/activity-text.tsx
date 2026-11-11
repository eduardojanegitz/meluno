import type { ActivityType } from "@/generated/prisma/enums";
import { Money } from "@/components/money/money";
import type { ActivityKind } from "./activity-item";

type Payload = Record<string, unknown>;

const get = <T,>(p: Payload, path: string): T | undefined =>
  path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Payload)[k] : undefined), p) as T | undefined;

export function activityKind(type: ActivityType): ActivityKind {
  switch (type) {
    case "EXPENSE_CREATED":
    case "EXPENSE_RESTORED":
    case "GROUP_CREATED":
      return "expense_created";
    case "EXPENSE_DELETED":
    case "SETTLEMENT_DELETED":
    case "SETTLEMENT_REJECTED":
    case "MEMBER_REMOVED":
    case "INVITATION_REVOKED":
      return "expense_deleted";
    case "SETTLEMENT_CREATED":
    case "SETTLEMENT_CONFIRMED":
      return "settlement";
    case "MEMBER_JOINED":
    case "MEMBER_ADDED":
    case "INVITATION_SENT":
      return "member_joined";
    default:
      return "expense_updated";
  }
}

/** Frase do histórico, montada a partir do tipo e do payload de auditoria. */
export function ActivityText({
  type,
  payload,
  currency,
  names,
}: {
  type: ActivityType;
  payload: unknown;
  currency: string;
  names: Record<string, string>;
}) {
  const p = (payload ?? {}) as Payload;
  const strong = (s: unknown) => <strong className="font-semibold">{String(s ?? "")}</strong>;
  const money = (v: unknown) => (typeof v === "number" ? <Money amountMinor={v} currency={currency} className="font-semibold" /> : null);
  const name = (id: unknown) => strong(typeof id === "string" ? (names[id] ?? "alguém") : "alguém");

  switch (type) {
    case "GROUP_CREATED":
      return <>criou o grupo {strong(p.name)}</>;
    case "GROUP_UPDATED":
      return <>alterou as configurações do grupo</>;
    case "GROUP_ARCHIVED":
      return <>arquivou o grupo</>;
    case "MEMBER_ADDED":
      return <>adicionou {strong(p.name)} ao grupo</>;
    case "MEMBER_JOINED":
      return <>entrou no grupo</>;
    case "MEMBER_LEFT":
      return <>saiu do grupo</>;
    case "MEMBER_REMOVED":
      return <>removeu {strong(p.name)} do grupo</>;
    case "MEMBER_ROLE_CHANGED":
      return (
        <>
          {p.role === "ADMIN" ? "tornou" : "removeu"} {strong(p.name)} {p.role === "ADMIN" ? "administrador(a)" : "da administração"}
        </>
      );
    case "INVITATION_SENT":
      return <>{p.kind === "EMAIL" ? "enviou um convite por e-mail" : "criou um link de convite"}</>;
    case "INVITATION_REVOKED":
      return <>cancelou um convite</>;
    case "EXPENSE_CREATED":
      return (
        <>
          adicionou {strong(get(p, "after.description"))} · {money(get(p, "after.amountMinor"))}
        </>
      );
    case "EXPENSE_UPDATED": {
      const before = get<number>(p, "before.amountMinor");
      const after = get<number>(p, "after.amountMinor");
      return (
        <>
          alterou {strong(get(p, "after.description"))}
          {before !== after ? (
            <>
              {" "}
              de {money(before)} para {money(after)}
            </>
          ) : null}
        </>
      );
    }
    case "EXPENSE_DELETED":
      return <>excluiu {strong(get(p, "before.description"))}</>;
    case "EXPENSE_RESTORED":
      return <>restaurou {strong(get(p, "after.description"))}</>;
    case "SETTLEMENT_CREATED":
      return (
        <>
          registrou um pagamento de {money(p.amountMinor)} de {name(p.fromMemberId)} para {name(p.toMemberId)}
          {p.status === "PENDING" ? " (aguardando confirmação)" : ""}
        </>
      );
    case "SETTLEMENT_CONFIRMED":
      return <>confirmou o recebimento de {money(p.amountMinor)} de {name(p.fromMemberId)}</>;
    case "SETTLEMENT_REJECTED":
      return <>recusou um pagamento de {money(p.amountMinor)} de {name(p.fromMemberId)}</>;
    case "SETTLEMENT_DELETED":
      return <>excluiu um pagamento de {money(p.amountMinor)}</>;
  }
}
