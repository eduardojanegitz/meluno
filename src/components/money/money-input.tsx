"use client";

import { forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/format";

/** Teto por valor (R$ 10.000.000,00) — mantém tudo bem dentro de inteiros seguros. */
export const MAX_AMOUNT_MINOR = 1_000_000_000;

type MoneyInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "size"> & {
  /** Valor em unidades mínimas (centavos). */
  value: number;
  onValueChange: (amountMinor: number) => void;
  currency?: string;
  max?: number;
  size?: "default" | "hero";
};

/**
 * Entrada no estilo de app bancário: os dígitos digitados preenchem a partir
 * dos centavos ("1", "15", "150" → R$ 0,01 · R$ 0,15 · R$ 1,50).
 * O valor nunca passa por ponto flutuante.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, currency = DEFAULT_CURRENCY, max = MAX_AMOUNT_MINOR, size = "default", className, ...props },
  ref,
) {
  const maxDigits = String(max).length;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxDigits);
      const next = digits === "" ? 0 : Number.parseInt(digits, 10);
      onValueChange(Math.min(next, max));
    },
    [max, maxDigits, onValueChange],
  );

  const moveCaretToEnd = (el: HTMLInputElement) => {
    const end = el.value.length;
    requestAnimationFrame(() => el.setSelectionRange(end, end));
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      data-slot="money-input"
      data-empty={value === 0 || undefined}
      value={formatMoney(value, { currency })}
      onChange={handleChange}
      onFocus={(e) => moveCaretToEnd(e.currentTarget)}
      onClick={(e) => moveCaretToEnd(e.currentTarget)}
      className={cn(
        "tabular w-full min-w-0 bg-transparent outline-none data-empty:text-muted-foreground/70",
        size === "hero"
          ? "font-display text-center text-5xl font-extrabold tracking-tight"
          : "border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-12 rounded-xl border px-4 text-base font-semibold shadow-xs focus-visible:ring-[3px] aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
});
