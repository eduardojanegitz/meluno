import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Archive, Plus, Users } from "lucide-react";
import { PageBody, PageHeader, SectionTitle } from "@/components/app/page-header";
import { GroupCard } from "@/components/group/group-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer } from "@/server/auth/session";
import { getDashboard } from "@/server/services/queries";

export const metadata: Metadata = { title: "Grupos" };

export default function GroupsPage() {
  return (
    <>
      <PageHeader
        brand
        title="Grupos"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/grupos/novo">
              <Plus /> Novo grupo
            </Link>
          </Button>
        }
      />
      <PageBody>
        <Suspense fallback={<ListSkeleton />}>
          <GroupList />
        </Suspense>
      </PageBody>
    </>
  );
}

async function GroupList() {
  const viewer = await requireViewer();
  const { groups } = await getDashboard(viewer);
  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  if (groups.length === 0) {
    return (
      <div className="bg-card rounded-3xl border">
        <EmptyState
          icon={Users}
          title="Tá vazio por aqui"
          mood="happy"
          description="Um grupo pra cada rolê: a viagem, a casa, o casal, o churrasco."
          action={
            <Button asChild>
              <Link href="/grupos/novo">
                <Plus /> Criar grupo
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const list = (items: typeof groups) => (
    <ul className="stagger space-y-3">
      {items.map((g) => (
        <li key={g.id}>
          <Link href={`/grupos/${g.id}`} className="pressable focus-visible:ring-ring block rounded-2xl outline-none focus-visible:ring-2">
            <GroupCard name={g.name} category={g.category} memberCount={g.memberCount} balanceMinor={g.balanceMinor} currency={g.currency} lastActivityAt={g.lastActivityAt} className={g.archived ? "opacity-70" : undefined} />
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-8">
      {list(active)}
      {archived.length > 0 ? (
        <section>
          <SectionTitle>
            <span className="inline-flex items-center gap-1.5">
              <Archive className="size-3.5" aria-hidden="true" /> Arquivados
            </span>
          </SectionTitle>
          {list(archived)}
        </section>
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[74px] w-full rounded-2xl" />
      ))}
    </div>
  );
}
