import type { Metadata } from "next";
import { groupPageMetadata } from "@/lib/page-titles";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ExpenseForm, type ExpenseInitial, type FormMember } from "@/components/expense/expense-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getExpense } from "@/server/services/expenses";
import { getGroupMembersForForm } from "@/server/services/queries";
import { idSchema } from "@/schemas/common";

export function generateMetadata({ params }: PageProps<"/grupos/[groupId]/despesas/[expenseId]/editar">): Promise<Metadata> {
  return groupPageMetadata(params, "Editar despesa", (t) => (t.expense ? `Editar ${t.expense}` : "Editar despesa"));
}

type Props = PageProps<"/grupos/[groupId]/despesas/[expenseId]/editar">;

export default function EditExpensePage(props: Props) {
  return (
    <Suspense fallback={<PageBody className="pt-20"><Skeleton className="h-96 w-full rounded-2xl" /></PageBody>}>
      <EditExpense {...props} />
    </Suspense>
  );
}

async function EditExpense({ params }: Props) {
  const { groupId, expenseId } = await params;
  if (!idSchema.safeParse(groupId).success || !idSchema.safeParse(expenseId).success) notFound();
  const viewer = await requireViewer();
  const [form, detail] = await Promise.all([getGroupMembersForForm(viewer, groupId), getExpense(viewer, groupId, expenseId)]).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { expense } = detail;
  if (!detail.canEdit || expense.deletedAt) redirect(`/grupos/${groupId}/despesas/${expenseId}`);

  // Ex-membros presentes na despesa continuam editáveis nela.
  const known = new Set(form.members.map((m) => m.id));
  const extra = await Promise.all(
    [...new Set([...expense.payers.map((p) => p.memberId), ...expense.splits.map((s) => s.memberId)])].filter((id) => !known.has(id)),
  );
  const members: FormMember[] = [...form.members, ...extra.map((id) => ({ id, name: "Ex-membro", provisional: false, imageUrl: null }))];

  return (
    <>
      <PageHeader backHref={`/grupos/${groupId}/despesas/${expenseId}`} backLabel="Cancelar" title="Editar despesa" subtitle={form.group.name} />
      <PageBody>
        <ExpenseForm
          group={form.group}
          members={members}
          viewerMemberId={form.viewerMemberId}
          initial={{
            expenseId: expense.id,
            version: expense.version,
            description: expense.description,
            amountMinor: expense.amountMinor,
            date: expense.date,
            category: expense.category,
            notes: expense.notes,
            payers: expense.payers,
            splitMethod: expense.splitMethod,
            splits: expense.splits.map((s) => ({ memberId: s.memberId, inputValue: s.inputValue })),
            items: expense.items.map((i) => ({ description: i.description, amountMinor: i.amountMinor, memberIds: i.members.map((m) => m.memberId) })),
            serviceBp: expense.serviceBp,
            feesMinor: expense.feesMinor,
            foreign: expense.foreign as ExpenseInitial["foreign"],
          }}
        />
      </PageBody>
    </>
  );
}
