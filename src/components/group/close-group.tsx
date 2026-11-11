"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Melu } from "@/components/brand/melu";
import { Money } from "@/components/money/money";
import { CivilDate } from "@/components/app/relative-time";
import { celebrate } from "@/components/celebrate/celebration";
import { useAction } from "@/hooks/use-action";
import { expenseCategories, type ExpenseCategory } from "@/lib/categories";
import { closeGroupAction, getGroupSummaryAction } from "@/server/actions/groups";

type Summary = Awaited<ReturnType<typeof getGroupSummaryAction>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never;

/** "Encerrar a viagem": resumo do grupo e arquivamento quando todo mundo está quite. */
export function CloseGroup({ groupId, groupName }: { groupId: string; groupName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const { run: loadSummary } = useAction(getGroupSummaryAction);
  const close = useAction(closeGroupAction);

  useEffect(() => {
    if (!open || summary) return;
    void loadSummary({ groupId }, { onSuccess: (s) => setSummary(s as Summary) });
  }, [open, summary, loadSummary, groupId]);

  const cat = summary?.topCategory ? expenseCategories[summary.topCategory.category as ExpenseCategory] : null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PartyPopper /> Encerrar o grupo
      </Button>
      <Dialog open={open} onOpenChange={(v) => !close.pending && setOpen(v)}>
        <DialogContent>
          <DialogHeader className="items-center text-center">
            <Melu mood="celebrate" size={88} />
            <DialogTitle>Fechando “{groupName}”</DialogTitle>
            <DialogDescription>Todo mundo está quite. Olha só como foi:</DialogDescription>
          </DialogHeader>

          {!summary ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Carregando resumo" />
            </div>
          ) : (
            <dl className="stagger grid grid-cols-2 gap-3">
              <Stat label="Gasto total">
                <Money amountMinor={summary.totalMinor} currency={summary.currency} />
              </Stat>
              <Stat label="Despesas">{summary.expenseCount}</Stat>
              {summary.topPayer ? (
                <Stat label="Quem mais pagou">
                  <span className="block truncate">{summary.topPayer.name}</span>
                  <Money amountMinor={summary.topPayer.amountMinor} currency={summary.currency} className="text-muted-foreground text-xs font-semibold" />
                </Stat>
              ) : null}
              {cat && summary.topCategory ? (
                <Stat label="Onde foi mais">
                  <span className="flex items-center gap-1.5">
                    <cat.icon className="size-4" aria-hidden="true" /> {cat.label}
                  </span>
                  <Money amountMinor={summary.topCategory.amountMinor} currency={summary.currency} className="text-muted-foreground text-xs font-semibold" />
                </Stat>
              ) : null}
              {summary.firstDate && summary.lastDate ? (
                <div className="bg-muted col-span-2 rounded-2xl px-4 py-3 text-center text-sm">
                  De <CivilDate value={summary.firstDate} /> a <CivilDate value={summary.lastDate} /> · {summary.settlementCount}{" "}
                  {summary.settlementCount === 1 ? "acerto" : "acertos"}
                </div>
              ) : null}
            </dl>
          )}

          <p className="text-muted-foreground text-center text-xs">O grupo fica arquivado: dá pra consultar tudo, mas não lançar gastos novos.</p>
          <Button
            className="w-full"
            disabled={!summary || close.pending}
            onClick={() =>
              close.run(
                { groupId },
                {
                  onSuccess: () => {
                    setOpen(false);
                    celebrate({ title: "Grupo encerrado!", subtitle: "Conta fechada, assunto resolvido.", big: true });
                    router.refresh();
                  },
                },
              )
            }
          >
            {close.pending ? <Loader2 className="animate-spin" /> : <Archive />} Encerrar e arquivar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border-2 px-4 py-3">
      <dt className="text-muted-foreground text-xs font-semibold">{label}</dt>
      <dd className="font-display mt-0.5 text-lg font-black">{children}</dd>
    </div>
  );
}
