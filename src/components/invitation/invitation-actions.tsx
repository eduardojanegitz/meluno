"use client";

import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { acceptInvitationAction, acceptInvitationByIdAction, declineInvitationAction } from "@/server/actions/groups";

export function AcceptByToken({ token }: { token: string }) {
  const router = useRouter();
  const accept = useAction(acceptInvitationAction);
  return (
    <Button
      size="lg"
      className="w-full"
      disabled={accept.pending}
      onClick={() =>
        accept.run(
          { token },
          {
            successMessage: "Você entrou no grupo",
            onSuccess: ({ groupId }) => {
              router.replace(`/grupos/${groupId}`);
              router.refresh();
            },
          },
        )
      }
    >
      {accept.pending ? <Loader2 className="animate-spin" /> : <Check />} Entrar no grupo
    </Button>
  );
}

export function PendingInvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const accept = useAction(acceptInvitationByIdAction);
  const decline = useAction(declineInvitationAction);
  return (
    <div className="mt-3 flex gap-2">
      <Button
        size="sm"
        variant="mint"
        disabled={accept.pending || decline.pending}
        onClick={() =>
          accept.run(
            { invitationId },
            {
              successMessage: "Você entrou no grupo",
              onSuccess: ({ groupId }) => {
                router.push(`/grupos/${groupId}`);
                router.refresh();
              },
            },
          )
        }
      >
        {accept.pending ? <Loader2 className="animate-spin" /> : <Check />} Aceitar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={accept.pending || decline.pending}
        onClick={() => decline.run({ invitationId }, { successMessage: "Convite recusado", onSuccess: () => router.refresh() })}
      >
        <X /> Recusar
      </Button>
    </div>
  );
}
