"use client";

import { civilToLocalDate, formatRelativeDay, formatRelativeTime } from "@/lib/format";

/**
 * Datas relativas calculadas no fuso do navegador ("hoje", "ontem").
 * O servidor pode estar em outro fuso; o texto é recalculado no cliente.
 */
export function RelativeTime({ date, className }: { date: Date | string; className?: string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} className={className} suppressHydrationWarning>
      {formatRelativeTime(d)}
    </time>
  );
}

/** Data civil da despesa ("2026-11-10") como "hoje", "ontem", "8 de nov.". */
export function CivilDate({ value, className }: { value: string; className?: string }) {
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {formatRelativeDay(civilToLocalDate(value))}
    </time>
  );
}
