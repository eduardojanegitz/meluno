"use client";

import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAction } from "@/hooks/use-action";
import { confirmSettlementAction, deleteSettlementAction, rejectSettlementAction } from "@/server/actions/finance";
import { celebrate } from "@/components/celebrate/celebration";

type Props = { groupId: string; settlementId: string; canDecide: boolean; canDelete: boolean; pending?: boolean; compact?: boolean };

export function SettlementActions({ groupId, settlementId, canDecide, canDelete, pending, compact }: Props) {
  const router = useRouter();
  const confirm = useAction(confirmSettlementAction);
  const reject = useAction(rejectSettlementAction);
  const remove = useAction(deleteSettlementAction);
  const busy = confirm.pending || reject.pending || remove.pending;
  const ref = { groupId, settlementId };
  const done = () => router.refresh();

  const deleteButton = canDelete ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size={compact ? "icon-sm" : "sm"} disabled={busy} aria-label="Excluir pagamento">
          <Trash2 />
          {compact ? null : "Excluir"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este pagamento?</AlertDialogTitle>
          <AlertDialogDescription>
            {pending ? "O registro deixa de aguardar confirmação." : "Os saldos voltam a considerar o valor como não pago."} A exclusão fica registrada no histórico.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => remove.run(ref, { successMessage: "Pagamento excluído", onSuccess: done })}>
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  if (compact) return deleteButton;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canDecide ? (
        <>
          <Button size="sm" variant="mint" disabled={busy} onClick={() =>
              confirm.run(ref, {
                onSuccess: ({ groupSettled }) => {
                  celebrate(groupSettled ? { title: "Tudo quite!", subtitle: "Ninguém deve nada a ninguém no grupo.", big: true } : { title: "Recebido!", subtitle: "Pagamento confirmado.", mood: "happy" });
                  done();
                },
              })
            }>
            {confirm.pending ? <Loader2 className="animate-spin" /> : <Check />} Confirmar recebimento
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => reject.run(ref, { successMessage: "Pagamento recusado", onSuccess: done })}>
            {reject.pending ? <Loader2 className="animate-spin" /> : <X />} Não recebi
          </Button>
        </>
      ) : (
        <span className="text-muted-foreground self-center text-xs">Aguardando quem recebeu confirmar.</span>
      )}
      {deleteButton}
    </div>
  );
}
