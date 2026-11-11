import type { Metadata } from "next";
import { groupPageMetadata } from "@/lib/page-titles";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { GroupSettings } from "@/components/group/group-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { requireViewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getGroupDetail } from "@/server/services/queries";
import { listGroupInvitations } from "@/server/services/invitations";
import { listRecurring } from "@/server/services/recurring";
import { idSchema } from "@/schemas/common";

export function generateMetadata({ params }: PageProps<"/grupos/[groupId]/configuracoes">): Promise<Metadata> {
  return groupPageMetadata(params, "Configurações do grupo", (t) => `Configurações · ${t.group}`);
}

type Props = PageProps<"/grupos/[groupId]/configuracoes">;

export default function GroupSettingsPage(props: Props) {
  return (
    <Suspense fallback={<PageBody className="space-y-4 pt-20"><Skeleton className="h-56 w-full rounded-2xl" /><Skeleton className="h-56 w-full rounded-2xl" /></PageBody>}>
      <Settings {...props} />
    </Suspense>
  );
}

async function Settings({ params }: Props) {
  const { groupId } = await params;
  if (!idSchema.safeParse(groupId).success) notFound();
  const viewer = await requireViewer();
  const [detail, invitations, recurring] = await Promise.all([getGroupDetail(viewer, groupId), listGroupInvitations(viewer, groupId), listRecurring(viewer, groupId)]).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });

  return (
    <>
      <PageHeader backHref={`/grupos/${groupId}`} backLabel={`Voltar para ${detail.group.name}`} title="Grupo" subtitle={detail.group.name} />
      <PageBody>
        <GroupSettings group={detail.group} isAdmin={detail.viewer.isAdmin} members={detail.members} invitations={invitations} recurring={recurring} />
      </PageBody>
    </>
  );
}
