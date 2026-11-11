import { CircleDollarSign, Pencil, Plus, Trash2, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/member-avatar";

export type ActivityKind = "expense_created" | "expense_updated" | "expense_deleted" | "settlement" | "member_joined";

const kindIcon: Record<ActivityKind, { icon: LucideIcon; className: string }> = {
  expense_created: { icon: Plus, className: "bg-primary text-primary-foreground" },
  expense_updated: { icon: Pencil, className: "bg-secondary text-secondary-foreground" },
  expense_deleted: { icon: Trash2, className: "bg-negative-soft text-negative" },
  settlement: { icon: CircleDollarSign, className: "bg-positive-soft text-positive" },
  member_joined: { icon: UserPlus, className: "bg-mint text-mint-foreground" },
};

type ActivityItemProps = {
  actorName: string;
  actorId: string;
  kind: ActivityKind;
  /** Frase já composta, ex.: <>adicionou <strong>Supermercado</strong></>. */
  children: React.ReactNode;
  context: string;
  timeLabel: string;
  className?: string;
};

export function ActivityItem({ actorName, actorId, kind, children, context, timeLabel, className }: ActivityItemProps) {
  const { icon: Icon, className: badge } = kindIcon[kind];
  return (
    <div className={cn("flex gap-3 py-3", className)}>
      <div className="relative shrink-0">
        <MemberAvatar name={actorName} colorKey={actorId} />
        <span
          className={cn(
            "ring-card absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full ring-2",
            badge,
          )}
        >
          <Icon className="size-2.5" strokeWidth={3} aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-semibold">{actorName}</span> {children}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {context} · {timeLabel}
        </p>
      </div>
    </div>
  );
}
