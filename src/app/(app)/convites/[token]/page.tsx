import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { PageBody } from "@/components/app/page-header";
import { GroupIcon } from "@/components/group/group-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AcceptByToken } from "@/components/invitation/invitation-actions";
import { requireViewer } from "@/server/auth/session";
import { previewInvitation } from "@/server/services/invitations";

export const metadata: Metadata = { title: "Convite", robots: { index: false } };

type Props = PageProps<"/convites/[token]">;

export default function InvitationPage(props: Props) {
  return (
    <PageBody className="flex max-w-md flex-col justify-center py-10">
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-3xl" />}>
        <Invitation {...props} />
      </Suspense>
    </PageBody>
  );
}

const stateText = {
  EXPIRED: "Este convite expirou. Peça um novo link para quem convidou você.",
  REVOKED: "Este convite foi cancelado.",
  USED: "Este convite já foi usado.",
  INVALID: "Este link de convite não é válido.",
} as const;

async function Invitation({ params }: Props) {
  const { token } = await params;
  const viewer = await requireViewer();
  const preview = await previewInvitation(viewer, token);

  if (preview.state === "VALID" && preview.alreadyMember) redirect(`/grupos/${preview.groupId}`);

  if (preview.state !== "VALID") {
    return (
      <div className="bg-card rounded-3xl border p-6 text-center">
        <CircleAlert className="text-muted-foreground mx-auto size-10" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold">Convite indisponível</h1>
        <p className="text-muted-foreground mt-2 text-sm">{stateText[preview.state]}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/inicio">Ir para o início</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card shadow-card rounded-3xl border p-6 text-center">
      <GroupIcon category={preview.category} className="mx-auto size-16 rounded-3xl" />
      <p className="text-muted-foreground mt-5 text-sm">{preview.inviterName} convidou você para</p>
      <h1 className="mt-1 text-2xl font-extrabold">{preview.groupName}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {preview.memberCount} {preview.memberCount === 1 ? "pessoa" : "pessoas"} no grupo
      </p>
      {preview.emailMismatch ? (
        <p className="bg-warning-soft text-warning mt-6 rounded-2xl px-4 py-3 text-sm">
          Este convite foi enviado para outro e-mail. Entre com a conta desse e-mail para aceitar.
        </p>
      ) : (
        <div className="mt-6">
          <AcceptByToken token={token} />
        </div>
      )}
    </div>
  );
}
