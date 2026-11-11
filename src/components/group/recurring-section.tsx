"use client";

import { useRouter } from "next/navigation";
import { Pause, Play, Repeat, Trash2 } from "lucide-react";
import { SectionTitle } from "@/components/app/page-header";
import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatCivilDate } from "@/lib/format";
import { manageRecurringAction } from "@/server/actions/groups";

export type RecurringItem = {
  id: string;
  description: string;
  amountMinor: number;
  frequency: "WEEKLY" | "MONTHLY";
  nextDate: string;
  status: "ACTIVE" | "PAUSED";
  pausedReason: string | null;
  createdByName: string;
  canManage: boolean;
};

/** Despesas que se repetem: próxima data, pausar/retomar/excluir. */
export function RecurringSection({ groupId, currency, items }: { groupId: string; currency: string; items: RecurringItem[] }) {
  const router = useRouter();
  const manage = useAction(manageRecurringAction);
  const act = (recurringId: string, action: "pause" | "resume" | "delete", message: string) =>
    manage.run({ groupId, recurringId, action }, { successMessage: message, onSuccess: () => router.refresh() });

  return (
    <section id="recorrentes" className="scroll-mt-24 space-y-2">
      <SectionTitle>Despesas recorrentes</SectionTitle>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aluguel, internet, assinaturas… Ao lançar uma despesa, escolha &ldquo;Toda semana&rdquo; ou &ldquo;Todo mês&rdquo; e ela entra sozinha.</p>
      ) : (
        <ul className="bg-card divide-y rounded-2xl border shadow-card">
          {items.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <Repeat className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.description}</p>
                  <p className="text-muted-foreground text-xs">
                    <Money amountMinor={r.amountMinor} currency={currency} /> · {r.frequency === "WEEKLY" ? "toda semana" : "todo mês"} · criada por {r.createdByName}
                  </p>
                  {r.status === "ACTIVE" ? (
                    <p className="text-muted-foreground text-xs">Próxima: {formatCivilDate(r.nextDate)}</p>
                  ) : (
                    <p className="text-xs">
                      <Badge variant="outline" className="mr-1">
                        Pausada
                      </Badge>
                      {r.pausedReason}
                    </p>
                  )}
                </div>
              </div>
              {r.canManage ? (
                <div className="mt-2 flex gap-1 pl-7">
                  {r.status === "ACTIVE" ? (
                    <Button type="button" size="sm" variant="ghost" disabled={manage.pending} onClick={() => act(r.id, "pause", "Recorrência pausada")}>
                      <Pause aria-hidden="true" /> Pausar
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" disabled={manage.pending} onClick={() => act(r.id, "resume", "Recorrência retomada")}>
                      <Play aria-hidden="true" /> Retomar
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={manage.pending} onClick={() => act(r.id, "delete", "Recorrência excluída. As despesas já lançadas continuam.")}>
                    <Trash2 aria-hidden="true" /> Excluir
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
