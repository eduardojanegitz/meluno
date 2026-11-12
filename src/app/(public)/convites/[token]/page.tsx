import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Melu } from "@/components/brand/melu";
import { GroupIcon } from "@/components/group/group-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AcceptByToken } from "@/components/invitation/invitation-actions";
import { getSession } from "@/server/auth/session";
import { previewInvitation, previewInvitationPublic } from "@/server/services/invitations";

type Props = PageProps<"/convites/[token]">;

/** Título e descrição da prévia do link (WhatsApp, Telegram, iMessage…). A imagem vem de opengraph-image.tsx. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const p = await previewInvitationPublic(token);
  const base = { robots: { index: false, follow: false } } satisfies Metadata;
  if (p.state !== "VALID") return { ...base, title: "Convite", description: "Convite do Meluno para dividir as despesas do grupo." };
  const title = `${p.inviterName} convidou você para “${p.groupName}”`;
  const description = `${p.memberCount} ${p.memberCount === 1 ? "pessoa já está" : "pessoas já estão"} no grupo. Entre no Meluno para dividir as despesas sem planilha e sem climão.`;
  return { ...base, title, description, openGraph: { title, description, type: "website", locale: "pt_BR", siteName: "Meluno" }, twitter: { card: "summary_large_image", title, description } };
}

export default function InvitationPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-3xl" />}>
      <Invitation {...props} />
    </Suspense>
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
  const session = await getSession();
  const preview = session
    ? await previewInvitation({ userId: session.user.id, name: session.user.name, email: session.user.email }, token)
    : { ...(await previewInvitationPublic(token)), alreadyMember: false, emailMismatch: false };

  if (preview.state === "VALID" && preview.alreadyMember && "groupId" in preview) redirect(`/grupos/${preview.groupId}`);

  if (preview.state !== "VALID") {
    return (
      <div className="bg-card rounded-3xl border p-6 text-center">
        <CircleAlert className="text-muted-foreground mx-auto size-10" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold">Convite indisponível</h1>
        <p className="text-muted-foreground mt-2 text-sm">{stateText[preview.state]}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={session ? "/inicio" : "/"}>{session ? "Ir para o início" : "Conhecer o Meluno"}</Link>
        </Button>
      </div>
    );
  }

  const here = `/convites/${encodeURIComponent(token)}`;
  return (
    <div className="bg-card shadow-card rounded-3xl border p-6 text-center">
      <GroupIcon category={preview.category} className="mx-auto size-16 rounded-3xl" />
      <p className="text-muted-foreground mt-5 text-sm">{preview.inviterName} convidou você para</p>
      <h1 className="mt-1 text-2xl font-extrabold">{preview.groupName}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {preview.memberCount} {preview.memberCount === 1 ? "pessoa" : "pessoas"} no grupo
      </p>
      {!session ? (
        <div className="mt-6 space-y-3">
          <Melu mood="happy" size={64} className="mx-auto" />
          <p className="text-muted-foreground text-sm">O Meluno anota os gastos do grupo e mostra quem deve quanto pra quem. Leva menos de um minuto.</p>
          <Button asChild size="lg" className="w-full">
            <Link href={`/criar-conta?next=${encodeURIComponent(here)}`}>Criar conta e entrar no grupo</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link href={`/entrar?next=${encodeURIComponent(here)}`}>Já tenho conta</Link>
          </Button>
        </div>
      ) : preview.emailMismatch ? (
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
