import type { LucideIcon } from "lucide-react";
import { Melu, type MeluMood } from "@/components/brand/melu";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Humor do Melu para o contexto (padrão: pensando). */
  mood?: MeluMood;
};

export function EmptyState({ icon: Icon, title, description, action, className, mood = "thinking" }: EmptyStateProps) {
  return (
    <div className={cn("animate-in fade-in-0 slide-in-from-bottom-2 flex flex-col items-center px-6 py-8 text-center duration-300", className)}>
      <div className="relative mb-4">
        <Melu mood={mood} size={92} />
        <span className="bg-card text-ink dark:text-foreground absolute -right-2 bottom-1 flex size-9 items-center justify-center rounded-xl border-2 shadow-card">
          <Icon className="size-4" strokeWidth={2.25} aria-hidden="true" />
        </span>
      </div>
      <h3 className="text-lg font-extrabold">{title}</h3>
      {description ? <p className="text-muted-foreground mt-1.5 max-w-xs text-sm text-balance">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
