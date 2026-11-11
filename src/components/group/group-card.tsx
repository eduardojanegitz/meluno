import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeDay } from "@/lib/format";
import { groupCategories, type GroupCategory } from "@/lib/categories";
import { BalanceLabel } from "@/components/balance/balance-label";

type GroupCardProps = {
  name: string;
  category: GroupCategory;
  memberCount: number;
  balanceMinor: number;
  currency?: string;
  lastActivityAt: Date | null;
  now?: Date;
  className?: string;
};

export function GroupIcon({ category, className }: { category: GroupCategory; className?: string }) {
  const Icon = groupCategories[category].icon;
  return (
    <span
      className={cn(
        "bg-secondary text-secondary-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

export function GroupCard({
  name,
  category,
  memberCount,
  balanceMinor,
  currency,
  lastActivityAt,
  now,
  className,
}: GroupCardProps) {
  return (
    <div
      className={cn(
        "bg-card border-border/70 shadow-card group/card flex items-center gap-3 rounded-2xl border p-3 pr-2.5 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-md",
        className,
      )}
    >
      <GroupIcon category={category} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {memberCount} {memberCount === 1 ? "pessoa" : "pessoas"}
          {lastActivityAt ? ` · ${formatRelativeDay(lastActivityAt, now)}` : " · sem despesas ainda"}
        </p>
      </div>
      <BalanceLabel amountMinor={balanceMinor} currency={currency} size="sm" />
      <ChevronRight
        className="text-muted-foreground/60 -ml-1 size-4 shrink-0 transition-transform group-hover/card:translate-x-0.5"
        aria-hidden="true"
      />
    </div>
  );
}
