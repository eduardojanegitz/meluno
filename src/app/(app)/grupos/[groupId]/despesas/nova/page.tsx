import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ExpenseForm } from "@/components/expense/expense-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getGroupMembersForForm } from "@/server/services/queries";
import { idSchema } from "@/schemas/common";

export const metadata: Metadata = { title: "Nova despesa" };

type Props = PageProps<"/grupos/[groupId]/despesas/nova">;

export default function NewExpensePage(props: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewExpense {...props} />
    </Suspense>
  );
}

async function NewExpense({ params }: Props) {
  const { groupId } = await params;
  if (!idSchema.safeParse(groupId).success) notFound();
  const viewer = await requireViewer();
  const data = await getGroupMembersForForm(viewer, groupId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  if (data.group.archived) notFound();
  return (
    <>
      <PageHeader backHref={`/grupos/${groupId}`} backLabel="Cancelar" title="Nova despesa" subtitle={data.group.name} />
      <PageBody>
        <ExpenseForm group={data.group} members={data.members} viewerMemberId={data.viewerMemberId} />
      </PageBody>
    </>
  );
}

function FormSkeleton() {
  return (
    <PageBody className="space-y-6 pt-20" >
      <Skeleton className="mx-auto h-14 w-56" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </PageBody>
  );
}
