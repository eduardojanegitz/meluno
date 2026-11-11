import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageBody, PageHeader, SectionTitle } from "@/components/app/page-header";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money/money";
import { RelativeTime } from "@/components/app/relative-time";
import { MarkNotificationsRead } from "@/components/activity/mark-read";
import { requireViewer } from "@/server/auth/session";
import { listActivity, listNotifications } from "@/server/services/queries";

export const metadata: Metadata = { title: "Atividade" };

export default function ActivityPage() {
  return (
    <>
      <PageHeader brand title="Atividade" subtitle="Tudo o que mudou nos seus grupos." />
      <PageBody className="space-y-8">
        <Suspense fallback={<FeedSkeleton />}>
          <Feed />
        </Suspense>
      </PageBody>
    </>
  );
}

type NotificationPayload = { by?: string; groupName?: string; description?: string; amountMinor?: number; currency?: string; name?: string };

function notificationText(type: string, p: NotificationPayload) {
  const amount = typeof p.amountMinor === "number" ? <Money amountMinor={p.amountMinor} currency={p.currency ?? "BRL"} className="font-semibold" /> : null;
  switch (type) {
    case "EXPENSE_ADDED":
      return <>{p.by} adicionou “{p.description}” {amount ? <>· {amount}</> : null}</>;
    case "EXPENSE_UPDATED":
      return <>{p.by} alterou “{p.description}”</>;
    case "EXPENSE_DELETED":
      return <>{p.by} excluiu “{p.description}”</>;
    case "INVITATION_RECEIVED":
      return <>{p.by} convidou você para “{p.groupName}”</>;
    case "SETTLEMENT_RECEIVED":
      return <>{p.by} registrou que você pagou {amount}</>;
    case "SETTLEMENT_CONFIRMATION_REQUESTED":
      return <>{p.by} informou um pagamento de {amount} para você. Confirme se recebeu.</>;
    case "SETTLEMENT_CONFIRMED":
      return <>{p.by} confirmou o recebimento de {amount}</>;
    case "SETTLEMENT_REJECTED":
      return <>{p.by} não reconheceu um pagamento de {amount}</>;
    case "MEMBER_JOINED":
      return <>{p.name} entrou em “{p.groupName}”</>;
    case "PAYMENT_REMINDER":
      return <>{p.by} lembrou você do acerto de {amount} em “{p.groupName}”</>;
    default:
      return <>Atualização em “{p.groupName}”</>;
  }
}

async function Feed() {
  const viewer = await requireViewer();
  const [activity, notifications] = await Promise.all([listActivity(viewer, { take: 50 }), listNotifications(viewer)]);
  const recent = notifications.items.slice(0, 10);

  return (
    <>
      {recent.length > 0 ? (
        <section>
          <SectionTitle>Para você</SectionTitle>
          <ul className="bg-card divide-y rounded-2xl border shadow-card">
            {recent.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.type === "INVITATION_RECEIVED" ? "/convites" : n.groupId ? `/grupos/${n.groupId}${n.type.startsWith("SETTLEMENT") || n.type === "PAYMENT_REMINDER" ? "?aba=saldos" : ""}` : "/inicio"}
                  className="hover:bg-muted/50 flex items-start gap-3 px-4 py-3"
                >
                  <span className={n.readAt ? "mt-1.5 size-2 shrink-0 rounded-full" : "bg-brand-dot mt-1.5 size-2 shrink-0 rounded-full"} aria-label={n.readAt ? undefined : "não lida"} />
                  <span className="min-w-0 flex-1 text-sm">
                    {notificationText(n.type, n.payload as NotificationPayload)}
                    <span className="text-muted-foreground block text-xs">
                      <RelativeTime date={n.createdAt} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {notifications.unread > 0 ? <MarkNotificationsRead /> : null}
        </section>
      ) : null}
      <section>
        <SectionTitle>Histórico</SectionTitle>
        <ActivityFeed feed={activity} />
      </section>
    </>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
