import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-2 flex flex-col items-center px-6 py-10 text-center duration-300",
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="bg-mint/60 dark:bg-mint/15 flex size-16 items-center justify-center rounded-3xl">
          <Icon className="text-ink dark:text-mint size-7" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <span className="bg-brand-dot ring-background absolute -right-1 -bottom-1 size-3.5 rounded-full ring-4" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {description ? <p className="text-muted-foreground mt-1.5 max-w-xs text-sm text-balance">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
