import type { Metadata } from "next";
import { groupPageMetadata } from "@/lib/page-titles";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageBody, PageHeader, SectionTitle } from "@/components/app/page-header";
import { MemberAvatar } from "@/components/member-avatar";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CivilDate, RelativeTime } from "@/components/app/relative-time";
import { ExpenseDangerZone } from "@/components/expense/expense-danger-zone";
import { expenseCategories } from "@/lib/categories";
import { PERCENT_SCALE, SHARES_SCALE } from "@/server/domain/split";
import { requireViewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getExpense } from "@/server/services/expenses";
import { getGroupMembersForForm } from "@/server/services/queries";
import { idSchema } from "@/schemas/common";

export function generateMetadata({ params }: PageProps<"/grupos/[groupId]/despesas/[expenseId]">): Promise<Metadata> {
  return groupPageMetadata(params, "Despesa", (t) => (t.expense ? `${t.expense} · ${t.group}` : t.group));
}

type Props = PageProps<"/grupos/[groupId]/despesas/[expenseId]">;

const methodText = { EQUAL: "Dividido igualmente", EXACT: "Valores personalizados", PERCENT: "Por porcentagem", SHARES: "Por partes", ITEMS: "Por item" } as const;
const historyText: Record<string, string> = {
  EXPENSE_CREATED: "registrou a despesa",
  EXPENSE_UPDATED: "editou a despesa",
  EXPENSE_DELETED: "excluiu a despesa",
  EXPENSE_RESTORED: "restaurou a despesa",
};

export default function ExpensePage(props: Props) {
  return (
    <Suspense
      fallback={
        <PageBody className="space-y-4 pt-20">
          <Skeleton className="mx-auto h-12 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </PageBody>
      }
    >
      <ExpenseView {...props} />
    </Suspense>
  );
}

async function ExpenseView({ params }: Props) {
  const { groupId, expenseId } = await params;
  if (!idSchema.safeParse(groupId).success || !idSchema.safeParse(expenseId).success) notFound();
  const viewer = await requireViewer();
  const [detail, form] = await Promise.all([getExpense(viewer, groupId, expenseId), getGroupMembersForForm(viewer, groupId)]).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { expense, history, canEdit, viewerMemberId } = detail;
  const name = (id: string) => (id === viewerMemberId ? "Você" : (form.members.find((m) => m.id === id)?.name ?? "Ex-membro"));
  const realName = (id: string) => form.members.find((m) => m.id === id)?.name ?? "Ex-membro";
  const currency = expense.currency;
  const Cat = expenseCategories[expense.category];
  const deleted = Boolean(expense.deletedAt);

  const inputLabel = (v: number | null) => {
    if (v === null) return null;
    if (expense.splitMethod === "PERCENT") return `${(v / (PERCENT_SCALE / 100)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
    if (expense.splitMethod === "SHARES") {
      const parts = v / SHARES_SCALE;
      return `${parts.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${parts === 1 ? "parte" : "partes"}`;
    }
    return null;
  };

  return (
    <>
      <PageHeader
        backHref={`/grupos/${groupId}`}
        backLabel={`Voltar para ${form.group.name}`}
        actions={
          canEdit && !deleted ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/grupos/${groupId}/despesas/${expenseId}/editar`}>
                <Pencil /> Editar
              </Link>
            </Button>
          ) : null
        }
      />
      <PageBody className="space-y-8">
        {deleted ? (
          <p className="bg-negative-soft text-negative rounded-2xl px-4 py-3 text-sm font-medium">Esta despesa foi excluída e não entra nos saldos.</p>
        ) : null}

        <div className="text-center">
          <span className="bg-secondary text-secondary-foreground mx-auto mb-3 flex size-14 items-center justify-center rounded-[20px]">
            <Cat.icon className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold">{expense.description}</h1>
          <Money amountMinor={expense.amountMinor} currency={currency} className="font-display mt-1 block text-[40px] leading-tight font-extrabold tracking-tight" />
          <p className="text-muted-foreground mt-1 text-sm">
            {Cat.label} · <CivilDate value={expense.date} /> · {form.group.name}
          </p>
        </div>

        <section>
          <SectionTitle>{expense.payers.length > 1 ? "Pagaram" : "Pagou"}</SectionTitle>
          <ul className="bg-card divide-y rounded-2xl border shadow-card">
            {expense.payers.map((p) => (
              <li key={p.memberId} className="flex items-center gap-3 px-4 py-3">
                <MemberAvatar name={realName(p.memberId)} colorKey={p.memberId} size="sm" />
                <span className="flex-1 text-sm font-medium">{name(p.memberId)}</span>
                <Money amountMinor={p.amountMinor} currency={currency} className="text-sm font-semibold" />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle>{methodText[expense.splitMethod]}</SectionTitle>
          <ul className="bg-card divide-y rounded-2xl border shadow-card">
            {expense.splits.map((s) => (
              <li key={s.memberId} className="flex items-center gap-3 px-4 py-3">
                <MemberAvatar name={realName(s.memberId)} colorKey={s.memberId} size="sm" />
                <span className="flex-1 text-sm font-medium">
                  {name(s.memberId)}
                  {inputLabel(s.inputValue) ? <span className="text-muted-foreground font-normal"> · {inputLabel(s.inputValue)}</span> : null}
                </span>
                <Money amountMinor={s.amountMinor} currency={currency} className="text-sm font-semibold" />
              </li>
            ))}
          </ul>
        </section>

        {expense.splitMethod === "ITEMS" && expense.items.length > 0 ? (
          <section>
            <SectionTitle>Itens</SectionTitle>
            <ul className="bg-card shadow-card divide-y rounded-2xl border">
              {expense.items.map((it, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{it.description}</span>
                    <Money amountMinor={it.amountMinor} currency={currency} className="font-semibold" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {it.members.map((m) => (
                      <span key={m.memberId} className="bg-muted inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-xs">
                        <MemberAvatar name={realName(m.memberId)} colorKey={m.memberId} size="sm" className="size-5" />
                        {name(m.memberId)}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
              {(expense.serviceBp ?? 0) > 0 || (expense.feesMinor ?? 0) > 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-xs">
                  {(expense.serviceBp ?? 0) > 0 ? <>Serviço de {((expense.serviceBp ?? 0) / 100).toLocaleString("pt-BR")}%</> : null}
                  {(expense.serviceBp ?? 0) > 0 && (expense.feesMinor ?? 0) > 0 ? " e " : null}
                  {(expense.feesMinor ?? 0) > 0 ? (
                    <>
                      taxas de <Money amountMinor={expense.feesMinor ?? 0} currency={currency} />
                    </>
                  ) : null}{" "}
                  divididos na proporção do que cada um consumiu.
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {expense.notes ? (
          <section>
            <SectionTitle>Observações</SectionTitle>
            <p className="bg-card rounded-2xl border shadow-card px-4 py-3 text-sm whitespace-pre-wrap">{expense.notes}</p>
          </section>
        ) : null}

        <section>
          <SectionTitle>Histórico</SectionTitle>
          <ol className="border-border ml-2 space-y-4 border-l-2 pl-5">
            {history.map((h) => {
              const p = h.payload as { before?: { amountMinor: number; description: string }; after?: { amountMinor: number; description: string } };
              return (
                <li key={h.id} className="relative text-sm">
                  <span className="bg-brand-dot ring-background absolute top-1.5 -left-[27px] size-2.5 rounded-full ring-4" aria-hidden="true" />
                  <p>
                    <span className="font-semibold">{h.actor?.displayName ?? "Alguém"}</span> {historyText[h.type] ?? "alterou a despesa"}
                  </p>
                  {h.type === "EXPENSE_UPDATED" && p.before && p.after ? (
                    <p className="text-muted-foreground text-xs">
                      {p.before.amountMinor !== p.after.amountMinor ? (
                        <>
                          Valor: <Money amountMinor={p.before.amountMinor} currency={currency} /> → <Money amountMinor={p.after.amountMinor} currency={currency} />.{" "}
                        </>
                      ) : null}
                      {p.before.description !== p.after.description ? (
                        <>
                          Descrição: “{p.before.description}” → “{p.after.description}”.
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    <RelativeTime date={h.createdAt} />
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        {canEdit ? <ExpenseDangerZone groupId={groupId} expenseId={expenseId} deleted={deleted} description={expense.description} /> : null}
      </PageBody>
    </>
  );
}
