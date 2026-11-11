"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
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
import { deleteExpenseAction, restoreExpenseAction } from "@/server/actions/finance";

type Props = { groupId: string; expenseId: string; deleted: boolean; description: string };

export function ExpenseDangerZone({ groupId, expenseId, deleted, description }: Props) {
  const router = useRouter();
  const del = useAction(deleteExpenseAction);
  const restore = useAction(restoreExpenseAction);
  const ref = { groupId, expenseId };

  if (deleted) {
    return (
      <Button
        variant="outline"
        className="w-full"
        disabled={restore.pending}
        onClick={() => restore.run(ref, { successMessage: "Despesa restaurada", onSuccess: () => router.refresh() })}
      >
        {restore.pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restaurar despesa
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:text-destructive w-full" disabled={del.pending}>
          {del.pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Excluir despesa
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{description}”?</AlertDialogTitle>
          <AlertDialogDescription>Os saldos do grupo serão recalculados. A despesa continua no histórico e pode ser restaurada.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-white"
            onClick={() =>
              del.run(ref, {
                onSuccess: () => {
                  toast("Despesa excluída", {
                    action: {
                      label: "Desfazer",
                      onClick: () => restore.run(ref, { successMessage: "Despesa restaurada", onSuccess: () => router.refresh() }),
                    },
                  });
                  router.push(`/grupos/${groupId}`);
                  router.refresh();
                },
              })
            }
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
