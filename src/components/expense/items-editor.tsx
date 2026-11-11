"use client";

import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/money/money-input";
import { MemberAvatar } from "@/components/member-avatar";
import { MAX_ITEMS, MAX_SERVICE_BP } from "@/server/domain/split";
import type { FormMember } from "./expense-form";

export type ItemDraft = { key: string; description: string; amountMinor: number; memberIds: string[] };

export const newItem = (memberIds: string[]): ItemDraft => ({ key: crypto.randomUUID(), description: "", amountMinor: 0, memberIds });

type Props = {
  items: ItemDraft[];
  onItems: (items: ItemDraft[]) => void;
  serviceBp: number;
  onServiceBp: (bp: number) => void;
  feesMinor: number;
  onFees: (v: number) => void;
  members: FormMember[];
  viewerMemberId: string;
  currency: string;
};

const SERVICE_PRESETS = [0, 1000, 1300];

/**
 * Editor da divisão por item: cada item tem nome, valor e quem consumiu.
 * Serviço (%) e taxas fixas são rateados na proporção do consumo.
 */
export function ItemsEditor({ items, onItems, serviceBp, onServiceBp, feesMinor, onFees, members, viewerMemberId, currency }: Props) {
  const update = (key: string, patch: Partial<ItemDraft>) => onItems(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const nameOf = (id: string) => (id === viewerMemberId ? "Você" : (members.find((m) => m.id === id)?.name ?? ""));
  const allIds = members.map((m) => m.id);

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((item, idx) => (
            <motion.li
              key={item.key}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="bg-card shadow-card rounded-2xl border-2 p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={item.description}
                  onChange={(e) => update(item.key, { description: e.target.value })}
                  placeholder={idx === 0 ? "Ex.: Pizza grande" : "Nome do item"}
                  maxLength={80}
                  aria-label={`Nome do item ${idx + 1}`}
                  className="h-10 flex-1"
                />
                <MoneyInput
                  value={item.amountMinor}
                  currency={currency}
                  onValueChange={(v) => update(item.key, { amountMinor: v })}
                  aria-label={`Valor do item ${idx + 1}`}
                  className="h-10 w-32 text-right"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover item ${idx + 1}`}
                  disabled={items.length === 1}
                  onClick={() => onItems(items.filter((i) => i.key !== item.key))}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Quem consumiu o item ${idx + 1}`}>
                {members.map((m) => {
                  const on = item.memberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update(item.key, { memberIds: on ? item.memberIds.filter((x) => x !== m.id) : [...item.memberIds, m.id] })}
                      className={cn(
                        "focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-full border-2 pr-3 pl-0.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2",
                        on ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground bg-card border-dashed opacity-70",
                      )}
                    >
                      <MemberAvatar name={m.name} colorKey={m.id} imageUrl={m.imageUrl} size="sm" className="size-6" />
                      {nameOf(m.id)}
                    </button>
                  );
                })}
                {item.memberIds.length !== allIds.length ? (
                  <button type="button" className="text-muted-foreground hover:text-foreground px-1 text-xs font-semibold underline-offset-4 hover:underline" onClick={() => update(item.key, { memberIds: allIds })}>
                    Todos
                  </button>
                ) : null}
              </div>
              {item.memberIds.length === 0 ? <p className="text-destructive mt-1.5 text-xs">Escolha quem consumiu.</p> : null}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {items.length < MAX_ITEMS ? (
        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => onItems([...items, newItem(allIds)])}>
          <Plus /> Adicionar item
        </Button>
      ) : null}

      <div className="bg-muted/60 space-y-3 rounded-2xl p-3">
        <div>
          <p className="text-sm font-semibold" id="service-label">
            Taxa de serviço
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby="service-label">
            {SERVICE_PRESETS.map((bp) => (
              <button
                key={bp}
                type="button"
                role="radio"
                aria-checked={serviceBp === bp}
                onClick={() => onServiceBp(bp)}
                className={cn(
                  "focus-visible:ring-ring h-9 rounded-full border-2 px-3.5 text-sm font-semibold outline-none focus-visible:ring-2",
                  serviceBp === bp ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                )}
              >
                {bp === 0 ? "Sem serviço" : `${bp / 100}%`}
              </button>
            ))}
            <div className="relative">
              <Input
                inputMode="decimal"
                aria-label="Outra porcentagem de serviço"
                placeholder="Outra"
                value={SERVICE_PRESETS.includes(serviceBp) ? "" : String(serviceBp / 100).replace(".", ",")}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  if (e.target.value === "") return onServiceBp(0);
                  if (Number.isFinite(n)) onServiceBp(Math.max(0, Math.min(MAX_SERVICE_BP, Math.round(n * 100))));
                }}
                className="h-9 w-24 pr-7 text-right"
              />
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="fees" className="text-sm font-semibold">
              Outras taxas
            </Label>
            <p className="text-muted-foreground text-xs">Entrega, couvert… divididas como o serviço.</p>
          </div>
          <MoneyInput id="fees" value={feesMinor} currency={currency} onValueChange={onFees} className="h-10 w-32 text-right" />
        </div>
      </div>
    </div>
  );
}
