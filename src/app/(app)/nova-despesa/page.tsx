import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { GroupCard } from "@/components/group/group-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer } from "@/server/auth/session";
import { getDashboard } from "@/server/services/queries";

export const metadata: Metadata = { title: "Escolha o grupo" };

const modes = {
  despesa: { title: "Nova despesa", subtitle: "Em qual grupo?", path: "despesas/nova" },
  pagamento: { title: "Registrar pagamento", subtitle: "Em qual grupo foi o acerto?", path: "acertar" },
  saldos: { title: "Quem deve a quem", subtitle: "Escolha o grupo para ver os saldos.", path: "?aba=saldos" },
} as const;

type Mode = keyof typeof modes;

export default function PickGroupPage({ searchParams }: PageProps<"/nova-despesa">) {
  return (
    <Suspense fallback={<PickerSkeleton />}>
      <Picker searchParams={searchParams} />
    </Suspense>
  );
}

async function Picker({ searchParams }: { searchParams: PageProps<"/nova-despesa">["searchParams"] }) {
  const raw = (await searchParams).para;
  const mode: Mode = raw === "pagamento" || raw === "saldos" ? raw : "despesa";
  const cfg = modes[mode];
  const viewer = await requireViewer();
  const groups = (await getDashboard(viewer)).groups.filter((g) => !g.archived);
  const target = (id: string) => (cfg.path.startsWith("?") ? `/grupos/${id}${cfg.path}` : `/grupos/${id}/${cfg.path}`);

  // Com um único grupo, pula a escolha.
  if (groups.length === 1) redirect(target(groups[0]!.id));

  return (
    <>
      <PageHeader backHref="/inicio" title={cfg.title} subtitle={cfg.subtitle} />
      <PageBody>
        {groups.length === 0 ? (
          <div className="bg-card rounded-3xl border">
            <EmptyState
              icon={Users}
              title="Primeiro, um grupo"
              description="Despesas sempre pertencem a um grupo — mesmo que sejam só duas pessoas."
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
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={target(g.id)} className="focus-visible:ring-ring block rounded-2xl outline-none focus-visible:ring-2">
                  <GroupCard name={g.name} category={g.category} memberCount={g.memberCount} balanceMinor={g.balanceMinor} currency={g.currency} lastActivityAt={g.lastActivityAt} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}

function PickerSkeleton() {
  return (
    <PageBody className="space-y-3 pt-16">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[74px] w-full rounded-2xl" />
      ))}
    </PageBody>
  );
}
