import type { Metadata } from "next";
import { groupPageMetadata } from "@/lib/page-titles";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Plus, Settings, UserPlus } from "lucide-react";
import { PageBody, PageHeader, SectionTitle } from "@/components/app/page-header";
import { GroupIcon } from "@/components/group/group-card";
import { MemberAvatar, MemberAvatarStack } from "@/components/member-avatar";
import { Money } from "@/components/money/money";
import { AnimatedMoney } from "@/components/money/animated-money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpendingTab } from "@/components/group/spending-tab";
import { CivilDate } from "@/components/app/relative-time";
import { ExpenseList } from "@/components/expense/expense-list";
import { SettlementActions } from "@/components/settlement/settlement-actions";
import { SettleActions } from "@/components/settlement/settle-actions";
import { CloseGroup } from "@/components/group/close-group";
import { groupCategories } from "@/lib/categories";
import { requireViewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getGroupDetail } from "@/server/services/queries";
import { idSchema } from "@/schemas/common";

export function generateMetadata({ params }: PageProps<"/grupos/[groupId]">): Promise<Metadata> {
  return groupPageMetadata(params, "Grupo", (t) => t.group);
}

type Props = PageProps<"/grupos/[groupId]">;

export default function GroupPage(props: Props) {
  return (
    <Suspense fallback={<GroupSkeleton />}>
      <GroupView {...props} />
    </Suspense>
  );
}

const methodLabel = { PIX: "Pix", CASH: "Dinheiro", TRANSFER: "Transferência", OTHER: "Outro" } as const;

async function GroupView({ params, searchParams }: Props) {
  const [{ groupId }, sp] = await Promise.all([params, searchParams]);
  if (!idSchema.safeParse(groupId).success) notFound();
  const viewer = await requireViewer();
  const data = await getGroupDetail(viewer, groupId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });

  const { group, members, expenses, settlements, suggestions } = data;
  const me = members.find((m) => m.isViewer)!;
  const nameOf = (id: string) => (id === me.id ? "Você" : (members.find((m) => m.id === id)?.name ?? "Ex-membro"));
  const realName = (id: string) => members.find((m) => m.id === id)?.name ?? "Ex-membro";
  const tab = sp.aba === "saldos" || sp.aba === "membros" || sp.aba === "gastos" ? sp.aba : "despesas";
  const pending = settlements.filter((s) => s.status === "PENDING");
  const confirmed = settlements.filter((s) => s.status === "CONFIRMED");
  const activeMembers = members.filter((m) => m.status === "ACTIVE" || m.status === "PROVISIONAL");

  return (
    <>
      <PageHeader
        backHref="/grupos"
        backLabel="Voltar para grupos"
        actions={
          <>
            {!group.archived ? (
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href={`/grupos/${group.id}/despesas/nova`}>
                  <Plus /> Despesa
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="icon" aria-label="Configurações e convites">
              <Link href={`/grupos/${group.id}/configuracoes`}>
                <Settings />
              </Link>
            </Button>
          </>
        }
      />
      <PageBody className="space-y-6">
        <div className="flex items-center gap-4">
          <GroupIcon category={group.category} className="size-14 rounded-[20px]" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl leading-tight font-extrabold md:text-3xl">{group.name}</h1>
            <p className="text-muted-foreground text-sm">
              {groupCategories[group.category].label} · {activeMembers.length} {activeMembers.length === 1 ? "pessoa" : "pessoas"}
              {group.archived ? " · arquivado" : ""}
            </p>
          </div>
          <div className="hidden sm:block">
            <MemberAvatarStack members={activeMembers.map((m) => ({ id: m.id, name: m.name, imageUrl: m.imageUrl }))} />
          </div>
        </div>

        <MyBalance amountMinor={me.balanceMinor} currency={group.currency} />

        {pending.some((s) => s.canDecide) ? (
          <p className="bg-warning-soft text-warning rounded-2xl px-4 py-3 text-sm font-medium">
            Há pagamentos aguardando sua confirmação na aba Saldos.
          </p>
        ) : null}

        <Tabs defaultValue={tab}>
          <TabsList className="bg-muted grid h-12 w-full grid-cols-4 rounded-2xl p-1">
            <TabsTrigger value="despesas" className="rounded-xl data-[state=active]:shadow-card">
              Despesas
            </TabsTrigger>
            <TabsTrigger value="saldos" className="rounded-xl data-[state=active]:shadow-card">
              Saldos{pending.some((s) => s.canDecide) ? <span className="bg-warning ml-1.5 size-2 rounded-full" aria-label="pendências" /> : null}
            </TabsTrigger>
            <TabsTrigger value="gastos" className="rounded-xl data-[state=active]:shadow-card">
              Gastos
            </TabsTrigger>
            <TabsTrigger value="membros" className="rounded-xl data-[state=active]:shadow-card">
              Pessoas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="despesas" className="mt-5">
            <ExpenseList
              groupId={group.id}
              currency={group.currency}
              archived={group.archived}
              expenses={expenses.map((e) => ({
                ...e,
                paidByLabel:
                  e.payerIds.length > 1 ? `${e.payerIds.length} pessoas pagaram` : `${nameOf(e.payerIds[0]!)} pagou`,
              }))}
            />
          </TabsContent>

          <TabsContent value="gastos" className="mt-5">
            <SpendingTab groupId={group.id} />
          </TabsContent>

          <TabsContent value="saldos" className="mt-5 space-y-8">
            <section>
              <SectionTitle>{group.simplifyDebts ? "Como acertar (simplificado)" : "Quem deve para quem"}</SectionTitle>
              {suggestions.length === 0 ? (
                <div className="bg-positive-soft text-positive flex flex-wrap items-center gap-3 rounded-2xl px-4 py-4 text-sm font-medium">
                  <Check className="size-5" aria-hidden="true" />
                  <span className="flex-1">Tudo acertado neste grupo.</span>
                  {data.viewer.isAdmin && !group.archived && expenses.length > 0 ? <CloseGroup groupId={group.id} groupName={group.name} /> : null}
                </div>
              ) : (
                <ul className="bg-card divide-y rounded-2xl border shadow-card">
                  {suggestions.map((d) => {
                    const person = (id: string) => {
                      const m = members.find((x) => x.id === id);
                      return { id, name: id === me.id ? "Você" : (m?.name ?? "Ex-membro"), hasAccount: m?.status === "ACTIVE" };
                    };
                    const realPerson = (id: string) => ({ ...person(id), name: realName(id) });
                    return (
                      <li key={`${d.fromMemberId}-${d.toMemberId}`} className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <MemberAvatar name={realName(d.fromMemberId)} colorKey={d.fromMemberId} size="sm" />
                          <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                          <MemberAvatar name={realName(d.toMemberId)} colorKey={d.toMemberId} size="sm" />
                          <p className="min-w-0 flex-1 text-sm">
                            <span className="font-semibold">{nameOf(d.fromMemberId)}</span> paga{" "}
                            <Money amountMinor={d.amountMinor} currency={group.currency} className="font-semibold" /> para{" "}
                            <span className="font-semibold">{nameOf(d.toMemberId)}</span>
                          </p>
                        </div>
                        {!group.archived ? (
                          <div className="mt-3 pl-[76px]">
                            <SettleActions
                              groupId={group.id}
                              groupName={group.name}
                              currency={group.currency}
                              viewerMemberId={me.id}
                              from={realPerson(d.fromMemberId)}
                              to={realPerson(d.toMemberId)}
                              amountMinor={d.amountMinor}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {group.simplifyDebts ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Sugestão com o menor número de transferências. Os registros originais não mudam.
                </p>
              ) : null}
            </section>

            {pending.length > 0 ? (
              <section>
                <SectionTitle>Aguardando confirmação</SectionTitle>
                <ul className="bg-card divide-y rounded-2xl border shadow-card">
                  {pending.map((s) => (
                    <li key={s.id} className="px-4 py-3.5">
                      <p className="text-sm">
                        <span className="font-semibold">{nameOf(s.fromMemberId)}</span> informou que pagou{" "}
                        <Money amountMinor={s.amountMinor} currency={group.currency} className="font-semibold" /> para{" "}
                        <span className="font-semibold">{nameOf(s.toMemberId)}</span>
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {methodLabel[s.method]} · <CivilDate value={s.date} />
                        {s.note ? ` · ${s.note}` : ""}
                      </p>
                      <SettlementActions groupId={group.id} settlementId={s.id} canDecide={s.canDecide} canDelete={s.canDelete} pending />
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">Pagamentos pendentes não alteram os saldos até serem confirmados por quem recebeu.</p>
              </section>
            ) : null}

            <section>
              <SectionTitle>Saldo de cada pessoa</SectionTitle>
              <ul className="bg-card divide-y rounded-2xl border shadow-card">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <MemberAvatar name={m.name} colorKey={m.id} imageUrl={m.imageUrl} provisional={m.status === "PROVISIONAL"} />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {m.isViewer ? "Você" : m.name}
                      {m.status === "LEFT" || m.status === "REMOVED" ? <span className="text-muted-foreground font-normal"> · ex-membro</span> : null}
                    </p>
                    {m.balanceMinor === 0 ? (
                      <span className="text-muted-foreground text-sm">quitado</span>
                    ) : (
                      <span className="text-right leading-tight">
                        <span className={m.balanceMinor > 0 ? "text-positive block text-[11px]" : "text-negative block text-[11px]"}>
                          {m.balanceMinor > 0 ? "a receber" : "deve"}
                        </span>
                        <Money amountMinor={m.balanceMinor} currency={group.currency} tone="auto" absolute className="text-sm font-semibold" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {confirmed.length > 0 ? (
              <section>
                <SectionTitle>Pagamentos registrados</SectionTitle>
                <ul className="bg-card divide-y rounded-2xl border shadow-card">
                  {confirmed.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-semibold">{nameOf(s.fromMemberId)}</span> pagou{" "}
                          <Money amountMinor={s.amountMinor} currency={group.currency} className="font-semibold" /> para{" "}
                          <span className="font-semibold">{nameOf(s.toMemberId)}</span>
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {methodLabel[s.method]} · <CivilDate value={s.date} />
                        </p>
                      </div>
                      <Badge variant="positive">Confirmado</Badge>
                      {s.canDelete && !group.archived ? <SettlementActions groupId={group.id} settlementId={s.id} canDecide={false} canDelete compact /> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="membros" className="mt-5 space-y-4">
            <ul className="bg-card divide-y rounded-2xl border shadow-card">
              {activeMembers.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <MemberAvatar name={m.name} colorKey={m.id} imageUrl={m.imageUrl} provisional={m.status === "PROVISIONAL"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.isViewer ? `${m.name} (você)` : m.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {m.status === "PROVISIONAL" ? (m.hasEmail ? "Convidado · ainda sem conta" : "Sem conta no Meluno") : m.role === "ADMIN" ? "Administrador(a)" : "Participante"}
                    </p>
                  </div>
                  {m.role === "ADMIN" && m.status === "ACTIVE" ? <Badge variant="secondary">Admin</Badge> : null}
                </li>
              ))}
            </ul>
            {!group.archived ? (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/grupos/${group.id}/configuracoes#convidar`}>
                  <UserPlus /> Convidar ou adicionar pessoas
                </Link>
              </Button>
            ) : null}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

function MyBalance({ amountMinor, currency }: { amountMinor: number; currency: string }) {
  const tone = amountMinor > 0 ? "bg-positive-soft text-positive" : amountMinor < 0 ? "bg-negative-soft text-negative" : "bg-muted text-muted-foreground";
  const label = amountMinor > 0 ? "Você tem a receber" : amountMinor < 0 ? "Você deve no grupo" : "Você está quite neste grupo";
  return (
    <div className={`flex items-center justify-between rounded-2xl px-4 py-3.5 ${tone}`}>
      <span className="text-sm font-medium">{label}</span>
      {amountMinor !== 0 ? <AnimatedMoney amountMinor={amountMinor} currency={currency} absolute className="font-display text-xl font-extrabold" /> : <Check className="size-5" aria-hidden="true" />}
    </div>
  );
}

function GroupSkeleton() {
  return (
    <PageBody className="space-y-6 pt-16" >
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-[20px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </PageBody>
  );
}
