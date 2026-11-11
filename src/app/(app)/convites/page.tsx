import type { Metadata } from "next";
import { Suspense } from "react";
import { MailOpen } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { GroupIcon } from "@/components/group/group-card";
import { Skeleton } from "@/components/ui/skeleton";
import { RelativeTime } from "@/components/app/relative-time";
import { PendingInvitationActions } from "@/components/invitation/invitation-actions";
import { requireViewer } from "@/server/auth/session";
import { listPendingInvitations } from "@/server/services/invitations";

export const metadata: Metadata = { title: "Convites" };

export default function InvitationsPage() {
  return (
    <>
      <PageHeader backHref="/inicio" title="Convites" subtitle="Grupos que convidaram você pelo seu e-mail." />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-28 w-full rounded-2xl" />}>
          <Pending />
        </Suspense>
      </PageBody>
    </>
  );
}

async function Pending() {
  const viewer = await requireViewer();
  const invitations = await listPendingInvitations(viewer);
  if (invitations.length === 0) {
    return (
      <div className="bg-card rounded-3xl border">
        <EmptyState icon={MailOpen} title="Nenhum convite por enquanto" mood="sleeping" description="Quando alguém te chamar pra um grupo, o convite aparece aqui." />
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {invitations.map((inv) => (
        <li key={inv.id} className="bg-card rounded-2xl border shadow-card p-4">
          <div className="flex items-center gap-3">
            <GroupIcon category={inv.group.category} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{inv.group.name}</p>
              <p className="text-muted-foreground text-xs">
                Convite de {inv.invitedBy.displayName} · <RelativeTime date={inv.createdAt} />
              </p>
            </div>
          </div>
          <PendingInvitationActions invitationId={inv.id} />
        </li>
      ))}
    </ul>
  );
}
