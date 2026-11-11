import { ArrowDownLeft, ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/money/money";

type BalanceLabelProps = {
  /** Saldo do usuário: > 0 a receber, < 0 deve, 0 quitado. */
  amountMinor: number;
  currency?: string;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Saldo com rótulo textual e ícone — o sentido nunca depende só da cor.
 */
export function BalanceLabel({ amountMinor, currency, size = "md", className }: BalanceLabelProps) {
  const state = amountMinor > 0 ? "receive" : amountMinor < 0 ? "owe" : "settled";
  const text = size === "sm" ? "text-xs" : "text-sm";

  if (state === "settled") {
    return (
      <span className={cn("text-muted-foreground inline-flex items-center gap-1 font-medium", text, className)}>
        <Check className="size-3.5" aria-hidden="true" />
        Tudo certo
      </span>
    );
  }

  const Icon = state === "receive" ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className={cn("inline-flex flex-col items-end leading-tight", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium",
          size === "sm" ? "text-[11px]" : "text-xs",
          state === "receive" ? "text-positive" : "text-negative",
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {state === "receive" ? "a receber" : "você deve"}
      </span>
      <Money
        amountMinor={amountMinor}
        currency={currency}
        tone="auto"
        absolute
        className={cn("font-semibold", size === "sm" ? "text-sm" : "text-base")}
      />
    </span>
  );
}
