import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { SettlementForm } from "@/components/settlement/settlement-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getGroupDetail, getGroupMembersForForm } from "@/server/services/queries";
import { idSchema } from "@/schemas/common";

export const metadata: Metadata = { title: "Registrar pagamento" };

type Props = PageProps<"/grupos/[groupId]/acertar">;

export default function SettlePage(props: Props) {
  return (
    <Suspense fallback={<PageBody className="pt-20"><Skeleton className="h-96 w-full rounded-2xl" /></PageBody>}>
      <Settle {...props} />
    </Suspense>
  );
}

async function Settle({ params, searchParams }: Props) {
  const [{ groupId }, sp] = await Promise.all([params, searchParams]);
  if (!idSchema.safeParse(groupId).success) notFound();
  const viewer = await requireViewer();
  const [form, detail] = await Promise.all([getGroupMembersForForm(viewer, groupId), getGroupDetail(viewer, groupId)]).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  if (form.group.archived) notFound();

  const ids = new Set(form.members.map((m) => m.id));
  const pick = (v: unknown) => (typeof v === "string" && ids.has(v) ? v : undefined);
  const valor = typeof sp.valor === "string" && /^\d{1,10}$/.test(sp.valor) ? Number(sp.valor) : 0;

  // Sem parâmetros: sugere a primeira transferência que envolve o usuário.
  const mine = detail.suggestions.find((d) => d.fromMemberId === form.viewerMemberId || d.toMemberId === form.viewerMemberId);
  const from = pick(sp.de) ?? mine?.fromMemberId ?? form.viewerMemberId;
  const fallbackTo = form.members.find((m) => m.id !== from)?.id ?? from;
  const to = pick(sp.para) ?? mine?.toMemberId ?? fallbackTo;
  const amount = valor || (pick(sp.de) ? 0 : (mine?.amountMinor ?? 0));

  return (
    <>
      <PageHeader backHref={`/grupos/${groupId}?aba=saldos`} backLabel="Cancelar" title="Registrar pagamento" subtitle={form.group.name} />
      <PageBody>
        {form.members.length < 2 ? (
          <p className="text-muted-foreground">Adicione mais alguém ao grupo para registrar pagamentos.</p>
        ) : (
          <SettlementForm group={form.group} members={form.members} viewerMemberId={form.viewerMemberId} initial={{ from, to: to === from ? fallbackTo : to, amountMinor: amount }} />
        )}
      </PageBody>
    </>
  );
}
