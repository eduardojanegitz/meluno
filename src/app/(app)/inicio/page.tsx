import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftRight, BellRing, ChevronRight, MailOpen, Plus, Scale, Users } from "lucide-react";
import { PageBody, PageHeader, SectionTitle } from "@/components/app/page-header";
import { GroupCard } from "@/components/group/group-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedMoney } from "@/components/money/animated-money";
import { Money } from "@/components/money/money";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { requireViewer } from "@/server/auth/session";
import { getDashboard, listActivity, type CurrencyTotals } from "@/server/services/queries";
import { listPendingInvitations } from "@/server/services/invitations";

export const metadata: Metadata = { title: "Início" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader brand />
      <PageBody className="space-y-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </PageBody>
    </>
  );
}

async function Dashboard() {
  const viewer = await requireViewer();
  const [data, activity, invitations] = await Promise.all([getDashboard(viewer), listActivity(viewer, { take: 5 }), listPendingInvitations(viewer)]);
  const first = viewer.name.split(/\s+/)[0];
  const active = data.groups.filter((g) => !g.archived);

  return (
    <>
      <div>
        <p className="text-muted-foreground text-sm">Olá, {first}</p>
        <h1 className="text-[26px] leading-tight font-extrabold md:text-3xl">Suas contas compartilhadas</h1>
      </div>

      <BalanceHero totals={data.totals} />

      {invitations.length > 0 ? (
        <Link href="/convites" className="bg-mint/60 dark:bg-mint/15 hover:bg-mint/80 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-colors">
          <MailOpen className="size-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            {invitations.length === 1 ? `Convite para “${invitations[0]!.group.name}”` : `${invitations.length} convites para grupos`}
          </span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}

      {data.pendingConfirmations > 0 ? (
        <Link
          href="/atividade"
          className="bg-warning-soft text-warning hover:bg-warning-soft/80 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-colors"
        >
          <BellRing className="size-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            {data.pendingConfirmations === 1 ? "1 pagamento aguarda" : `${data.pendingConfirmations} pagamentos aguardam`} sua confirmação
          </span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}

      <QuickActions hasGroups={active.length > 0} />

      <section aria-labelledby="dash-groups">
        <SectionTitle
          action={
            data.groups.length > 0 ? (
              <Link href="/grupos" className="text-muted-foreground hover:text-foreground text-sm font-medium">
                Ver todos
              </Link>
            ) : null
          }
        >
          <span id="dash-groups">Seus grupos</span>
        </SectionTitle>
        {active.length === 0 ? (
          <div className="bg-card rounded-3xl border">
            <EmptyState
              icon={Users}
              title="Comece criando um grupo"
              description="Viagem, casa, casal ou o churrasco de sábado: crie um grupo e convide quem divide com você."
              action={
                <Button asChild>
                  <Link href="/grupos/novo">
                    <Plus /> Criar grupo
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {active.slice(0, 5).map((g) => (
              <li key={g.id}>
                <Link href={`/grupos/${g.id}`} className="focus-visible:ring-ring block rounded-2xl outline-none focus-visible:ring-2">
                  <GroupCard
                    name={g.name}
                    category={g.category}
                    memberCount={g.memberCount}
                    balanceMinor={g.balanceMinor}
                    currency={g.currency}
                    lastActivityAt={g.lastActivityAt}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.groups.length > 0 ? (
        <section aria-labelledby="dash-activity">
          <SectionTitle
            action={
              <Link href="/atividade" className="text-muted-foreground hover:text-foreground text-sm font-medium">
                Ver tudo
              </Link>
            }
          >
            <span id="dash-activity">Atividade recente</span>
          </SectionTitle>
          <ActivityFeed feed={activity} />
        </section>
      ) : null}
    </>
  );
}

function BalanceHero({ totals }: { totals: CurrencyTotals[] }) {
  const main = totals[0] ?? { currency: "BRL", receivableMinor: 0, payableMinor: 0, netMinor: 0 };
  const others = totals.slice(1);
  const state = main.netMinor > 0 ? "no total, você tem a receber" : main.netMinor < 0 ? "no total, você deve" : "tudo acertado por aqui";

  return (
    <section aria-label="Saldo geral" className="relative overflow-hidden rounded-3xl bg-[#172D40] p-5 text-white sm:p-6 dark:ring-1 dark:ring-white/10">
      <div aria-hidden="true" className="bg-mint/20 absolute -top-20 -right-16 size-56 rounded-full blur-3xl" />
      <p className="text-sm text-white/70">Saldo geral</p>
      <AnimatedMoney amountMinor={main.netMinor} currency={main.currency} absolute className="font-display mt-1 block text-[40px] leading-tight font-extrabold tracking-tight text-white" />
      <p className="text-sm text-white/70">{state}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/8 p-3">
          <p className="text-xs text-white/70">A receber</p>
          <Money amountMinor={main.receivableMinor} currency={main.currency} className={main.receivableMinor > 0 ? "text-mint font-semibold" : "font-semibold text-white"} />
        </div>
        <div className="rounded-2xl bg-white/8 p-3">
          <p className="text-xs text-white/70">Você deve</p>
          <Money amountMinor={main.payableMinor} currency={main.currency} className={main.payableMinor > 0 ? "font-semibold text-[#ffb8a6]" : "font-semibold text-white"} />
        </div>
      </div>
      {others.length > 0 ? (
        <p className="mt-4 text-xs text-white/70">
          Outras moedas (não somadas):{" "}
          {others.map((t, i) => (
            <span key={t.currency}>
              {i > 0 ? " · " : ""}
              <Money amountMinor={t.netMinor} currency={t.currency} signed className="text-white" />
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}

function QuickActions({ hasGroups }: { hasGroups: boolean }) {
  const actions = [
    { href: "/nova-despesa", label: "Nova despesa", icon: Plus, primary: true, needsGroup: true },
    { href: "/grupos/novo", label: "Novo grupo", icon: Users, needsGroup: false },
    { href: "/nova-despesa?para=pagamento", label: "Registrar pagamento", icon: ArrowLeftRight, needsGroup: true },
    { href: "/nova-despesa?para=saldos", label: "Quem deve a quem", icon: Scale, needsGroup: true },
  ].filter((a) => hasGroups || !a.needsGroup);

  if (!hasGroups) return null;
  return (
    <nav aria-label="Ações rápidas" className="grid grid-cols-4 gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group focus-visible:ring-ring flex flex-col items-center gap-2 rounded-2xl py-2 text-center outline-none focus-visible:ring-2"
          >
            <span
              className={
                a.primary
                  ? "bg-mint text-mint-foreground flex size-14 items-center justify-center rounded-2xl transition-transform group-active:scale-95"
                  : "bg-card text-foreground shadow-card flex size-14 items-center justify-center rounded-2xl border transition-transform group-active:scale-95"
              }
            >
              <Icon className="size-[22px]" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="text-xs leading-tight font-medium">{a.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-48 w-full rounded-3xl" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="mx-auto size-14 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[74px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
