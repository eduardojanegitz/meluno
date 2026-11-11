"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/money/money-input";
import { useAction } from "@/hooks/use-action";
import { formatCivilDate } from "@/lib/format";
import { suggestRateAction } from "@/server/actions/finance";

import type { z } from "zod";
import type { currencySchema } from "@/schemas/common";

export type Currency = z.infer<typeof currencySchema>;
export type ForeignDraft = { currency: Currency; amountMinor: number; rate: string };

const CURRENCIES: { code: Currency; label: string }[] = [
  { code: "USD", label: "Dólar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "Libra (GBP)" },
  { code: "ARS", label: "Peso argentino (ARS)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "UYU", label: "Peso uruguaio (UYU)" },
  { code: "PYG", label: "Guarani (PYG)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "JPY", label: "Iene (JPY)" },
  { code: "CAD", label: "Dólar canadense (CAD)" },
  { code: "AUD", label: "Dólar australiano (AUD)" },
  { code: "CHF", label: "Franco suíço (CHF)" },
  { code: "BRL", label: "Real (BRL)" },
];

export const firstForeignCurrency = (groupCurrency: string): Currency => (groupCurrency === "USD" ? "EUR" : "USD");

/**
 * Valor em outra moeda + cotação. A cotação do dia (BCE) é sugerida sozinha quando existe;
 * a pessoa troca à vontade (cartão com IOF, casa de câmbio…). Quem manda é o que está no campo.
 */
export function ForeignCurrencyFields({
  groupCurrency,
  date,
  value,
  onChange,
  error,
}: {
  groupCurrency: string;
  date: string;
  value: ForeignDraft;
  /** Sempre com função de atualização: a cotação sugerida chega depois e não pode apagar o que foi digitado. */
  onChange: (update: (prev: ForeignDraft) => ForeignDraft) => void;
  error: string | null;
}) {
  const { run: suggest, pending } = useAction(suggestRateAction);
  const [source, setSource] = useState<{ date: string; rate: string } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // Ref (não estado): a resposta da busca precisa ver se a pessoa digitou depois que ela começou.
  const touched = useRef(Boolean(value.rate));

  // Ao trocar moeda ou data: busca a referência; só preenche se a pessoa não digitou a dela.
  useEffect(() => {
    let alive = true;
    void suggest({ from: value.currency, to: groupCurrency as Currency, date }, { silentError: true }).then((r) => {
      if (!alive) return;
      if (r.ok && r.data.available) {
        setUnavailable(false);
        setSource({ date: r.data.date, rate: r.data.rate });
        const rate = r.data.rate;
        if (!touched.current) onChange((prev) => ({ ...prev, rate }));
      } else {
        setUnavailable(true);
        setSource(null);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao trocar moeda/data
  }, [value.currency, groupCurrency, date]);

  return (
    <div className="bg-muted/60 mx-auto mt-3 max-w-sm space-y-3 rounded-2xl p-3 text-left">
      <div className="grid grid-cols-[1fr_1.2fr] gap-2">
        <div className="space-y-1">
          <Label htmlFor="fx-currency" className="text-xs">
            Moeda
          </Label>
          <select
            id="fx-currency"
            value={value.currency}
            onChange={(e) => {
              touched.current = false;
              const currency = e.target.value as Currency;
              onChange((prev) => ({ ...prev, currency, rate: "" }));
            }}
            className="border-input bg-card h-10 w-full rounded-xl border px-2 text-sm"
          >
            {CURRENCIES.filter((c) => c.code !== groupCurrency).map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fx-amount" className="text-xs">
            Valor pago
          </Label>
          <MoneyInput id="fx-amount" value={value.amountMinor} currency={value.currency} onValueChange={(v) => onChange((prev) => ({ ...prev, amountMinor: v }))} className="h-10 text-right" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="fx-rate" className="text-xs">
          Cotação: 1 {value.currency} = quantos {groupCurrency}?
        </Label>
        <div className="relative">
          <Input
            id="fx-rate"
            inputMode="decimal"
            value={value.rate}
            onChange={(e) => {
              touched.current = true;
              const rate = e.target.value;
              onChange((prev) => ({ ...prev, rate }));
            }}
            placeholder="Ex.: 5,4321"
            aria-invalid={error ? true : undefined}
            aria-describedby="fx-hint"
            className="h-10 pr-9"
          />
          {pending ? <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" aria-hidden="true" /> : null}
        </div>
        <p id="fx-hint" className="text-muted-foreground text-xs">
          {source
            ? source.rate === value.rate
              ? `Referência do Banco Central Europeu de ${formatCivilDate(source.date)}. Se o cartão cobrou outra (com IOF), troque aqui.`
              : `Referência do BCE em ${formatCivilDate(source.date)}: ${source.rate}. Você está usando a sua.`
            : unavailable
              ? "Sem cotação automática para essa moeda. Digite a que você pagou."
              : "Buscando a cotação do dia…"}
        </p>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </div>
  );
}
