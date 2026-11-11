import { cn } from "@/lib/utils";
import { expenseCategories, type ExpenseCategory } from "@/lib/categories";
import { Money } from "@/components/money/money";

type ExpenseRowProps = {
  description: string;
  category: ExpenseCategory;
  totalMinor: number;
  /** Ex.: "Você pagou", "Maria pagou", "2 pessoas pagaram". */
  paidByLabel: string;
  originalLabel?: string | null;
  /** Efeito líquido da despesa para o usuário: > 0 emprestou, < 0 deve, 0 não participa. */
  userImpactMinor: number;
  currency?: string;
  dateLabel: React.ReactNode;
  className?: string;
};

export function ExpenseRow({
  description,
  category,
  totalMinor,
  paidByLabel,
  originalLabel,
  userImpactMinor,
  currency,
  dateLabel,
  className,
}: ExpenseRowProps) {
  const Icon = expenseCategories[category].icon;
  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{description}</p>
        <p className="text-muted-foreground truncate text-xs">
          {paidByLabel} <Money amountMinor={totalMinor} currency={currency} className="text-muted-foreground" />
          {originalLabel ? ` (${originalLabel})` : null} ·{" "}
          {dateLabel}
        </p>
      </div>
      <div className="text-right leading-tight">
        {userImpactMinor === 0 ? (
          <span className="text-muted-foreground text-xs">não participa</span>
        ) : (
          <>
            <span className={cn("block text-[11px]", userImpactMinor > 0 ? "text-positive" : "text-negative")}>
              {userImpactMinor > 0 ? "emprestou" : "você deve"}
            </span>
            <Money amountMinor={userImpactMinor} currency={currency} tone="auto" absolute className="text-sm font-semibold" />
          </>
        )}
      </div>
    </div>
  );
}
