import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

export type MoneyTone = "auto" | "neutral" | "positive" | "negative";

type MoneyProps = {
  amountMinor: number;
  currency?: string;
  /** "auto": verde se > 0, coral se < 0, neutro se 0. */
  tone?: MoneyTone;
  /** Mostra "+" em valores positivos. */
  signed?: boolean;
  /** Exibe sempre o valor absoluto (o rótulo ao redor carrega o sentido). */
  absolute?: boolean;
  className?: string;
};

export function toneFor(amountMinor: number, tone: MoneyTone): Exclude<MoneyTone, "auto"> {
  if (tone !== "auto") return tone;
  if (amountMinor > 0) return "positive";
  if (amountMinor < 0) return "negative";
  return "neutral";
}

export const toneClass = {
  neutral: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
} as const;

export function Money({ amountMinor, currency, tone = "neutral", signed, absolute, className }: MoneyProps) {
  const value = absolute ? Math.abs(amountMinor) : amountMinor;
  return (
    <span className={cn("tabular whitespace-nowrap", toneClass[toneFor(amountMinor, tone)], className)}>
      {formatMoney(value, { currency, signDisplay: signed ? "exceptZero" : "auto" })}
    </span>
  );
}
