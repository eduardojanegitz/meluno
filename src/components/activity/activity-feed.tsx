import Link from "next/link";
import { History } from "lucide-react";
import { ActivityItem } from "./activity-item";
import { ActivityText, activityKind } from "./activity-text";
import { RelativeTime } from "@/components/app/relative-time";
import { EmptyState } from "@/components/empty-state";
import type { listActivity } from "@/server/services/queries";

type Feed = Awaited<ReturnType<typeof listActivity>>;

export function ActivityFeed({ feed, showGroup = true, emptyText }: { feed: Feed; showGroup?: boolean; emptyText?: string }) {
  if (feed.items.length === 0) {
    return <EmptyState icon={History} title="Tudo quietinho"
        mood="sleeping" description={emptyText ?? "As alterações nos seus grupos aparecem aqui."} />;
  }
  return (
    <ul className="stagger bg-card divide-y rounded-2xl border shadow-card px-4">
      {feed.items.map((item) => {
        const actorName = item.isViewer ? "Você" : (item.actor?.displayName ?? "Alguém");
        const href =
          item.entityType === "expense" && item.entityId && item.type !== "EXPENSE_DELETED"
            ? `/grupos/${item.groupId}/despesas/${item.entityId}`
            : `/grupos/${item.groupId}`;
        return (
          <li key={item.id}>
            <Link href={href} className="pressable hover:bg-muted/50 -mx-4 block rounded-xl px-4 transition-colors">
              <ActivityItem
                actorName={actorName}
                avatarName={item.actor?.displayName ?? "Alguém"}
                actorId={item.actor?.id ?? item.id}
                kind={activityKind(item.type)}
                context={showGroup ? item.group.name : ""}
                timeLabel={<RelativeTime date={item.createdAt} />}
              >
                <ActivityText type={item.type} payload={item.payload} currency={item.group.currency} names={feed.memberNames} />
              </ActivityItem>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
