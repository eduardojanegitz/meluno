"use client";

import { useEffect, useId, useState } from "react";
import { PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { expenseCategories, type ExpenseCategory } from "@/lib/categories";
import { useAction } from "@/hooks/use-action";
import { getSpendingAction } from "@/server/actions/groups";
import type { GroupSpending } from "@/server/services/spending";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";

type Period = "month" | "3m" | "year" | "all";
const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "Este mês" },
  { value: "3m", label: "3 meses" },
  { value: "year", label: "Este ano" },
  { value: "all", label: "Tudo" },
];

const monthName = (m: string, style: "short" | "long") => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, mo - 1, 1));
  return new Intl.DateTimeFormat("pt-BR", { month: style, ...(style === "long" ? { year: "numeric" } : {}), timeZone: "UTC" }).format(d).replace(".", "");
};

/**
 * Aba "Gastos": para onde foi o dinheiro do grupo.
 * Um tom só (magnitude), barras finas, valores escritos ao lado, dica ao tocar/focar,
 * e a mesma informação em tabela. Acertos não entram: não são gasto.
 */
export function SpendingTab({ groupId }: { groupId: string }) {
  const [period, setPeriod] = useState<Period>("3m");
  const [data, setData] = useState<GroupSpending | null>(null);
  const [asTable, setAsTable] = useState(false);
  const { run, pending } = useAction(getSpendingAction);

  useEffect(() => {
    void run({ groupId, period }, { silentError: false, onSuccess: setData });
  }, [run, groupId, period]);

  return (
    <div className="space-y-5">
      {/* Filtro: uma linha, acima de tudo que ele afeta. */}
      <div role="radiogroup" aria-label="Período" className="bg-muted grid grid-cols-4 gap-1 rounded-2xl p-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={period === p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "focus-visible:ring-ring h-9 rounded-xl text-xs font-bold outline-none focus-visible:ring-2 sm:text-sm",
              period === p.value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : data.count === 0 ? (
        <EmptyState icon={PieChart} title="Nenhum gasto nesse período" description="Quando o grupo lançar despesas, você vê aqui para onde foi o dinheiro." />
      ) : (
        // Recarregando: mantém o quadro anterior mais apagado, sem saltos.
        <div className={cn("space-y-5 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
          <Headline data={data} />
          {asTable ? (
            <SpendingTable data={data} />
          ) : (
            <>
              {data.byMonth.length >= 2 ? <MonthChart data={data} /> : null}
              <MeterCard
                title="Por categoria"
                currency={data.currency}
                total={data.totalMinor}
                rows={data.byCategory.map((c) => ({ key: c.category, label: expenseCategories[c.category as ExpenseCategory]?.label ?? c.category, valueMinor: c.amountMinor }))}
              />
              <MeterCard
                title="Parte de cada um"
                hint="O que cada pessoa consumiu, pela divisão das despesas."
                currency={data.currency}
                total={data.totalMinor}
                rows={data.byMember.map((m) => ({
                  key: m.memberId,
                  label: m.memberId === data.viewerMemberId ? "Você" : m.name,
                  valueMinor: m.shareMinor,
                  // Acertos (Pix entre as pessoas) não entram: são devolução, não gasto.
                  detail: `pagou ${formatMoney(m.paidMinor, { currency: data.currency })} nas despesas`,
                }))}
              />
            </>
          )}
          <button type="button" onClick={() => setAsTable((v) => !v)} className="text-muted-foreground hover:text-foreground text-sm font-semibold underline-offset-4 hover:underline">
            {asTable ? "Ver como gráfico" : "Ver como tabela"}
          </button>
        </div>
      )}
    </div>
  );
}

function Headline({ data }: { data: GroupSpending }) {
  const mine = data.byMember.find((m) => m.memberId === data.viewerMemberId)?.shareMinor ?? 0;
  const top = data.byCategory[0];
  const money = (v: number) => formatMoney(v, { currency: data.currency });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card shadow-card col-span-2 rounded-2xl border p-4">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Total do grupo</p>
        <p className="font-display tabular text-[40px] leading-tight font-black">{money(data.totalMinor)}</p>
        <p className="text-muted-foreground text-sm">
          {data.count} {data.count === 1 ? "despesa" : "despesas"}
        </p>
      </div>
      <div className="bg-card shadow-card rounded-2xl border p-4">
        <p className="text-muted-foreground text-xs font-semibold">Sua parte</p>
        <p className="tabular text-lg font-extrabold">{money(mine)}</p>
      </div>
      <div className="bg-card shadow-card rounded-2xl border p-4">
        <p className="text-muted-foreground text-xs font-semibold">Maior categoria</p>
        <p className="truncate text-lg font-extrabold">{top ? (expenseCategories[top.category as ExpenseCategory]?.label ?? top.category) : "—"}</p>
      </div>
    </div>
  );
}

/** Colunas por mês: 24 px no máximo, ponta arredondada de 4 px, base reta; valor do maior mês escrito. */
function MonthChart({ data }: { data: GroupSpending }) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const months = data.byMonth;
  const max = Math.max(...months.map((m) => m.amountMinor), 1);
  const peak = months.findIndex((m) => m.amountMinor === max);
  const W = 320;
  const H = 150;
  const top = 22;
  const base = H - 22;
  const band = W / months.length;
  const barW = Math.min(24, band * 0.6);
  const money = (v: number) => formatMoney(v, { currency: data.currency });
  const shown = active ?? null;

  return (
    <section className="bg-card shadow-card rounded-2xl border p-4" aria-labelledby={titleId}>
      <h3 id={titleId} className="text-sm font-bold">
        Por mês
      </h3>
      <p className="text-muted-foreground mt-0.5 min-h-5 text-xs" aria-live="polite">
        {shown !== null ? (
          <>
            <strong className="text-foreground tabular">{money(months[shown]!.amountMinor)}</strong> em {monthName(months[shown]!.month, "long")}
          </>
        ) : (
          "Toque numa coluna para ver o valor."
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full overflow-visible" role="group" aria-label="Gastos por mês">
        {/* Linha de base recessiva. */}
        <line x1={0} x2={W} y1={base} y2={base} className="stroke-border" strokeWidth={1} />
        {months.map((m, i) => {
          const h = m.amountMinor === 0 ? 0 : Math.max(2, ((base - top) * m.amountMinor) / max);
          const x = i * band + (band - barW) / 2;
          const y = base - h;
          const r = Math.min(4, h);
          const isActive = active === i;
          // Retângulo com cantos de cima arredondados e base reta.
          const d = h === 0 ? "" : `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${base} Z`;
          return (
            <g key={m.month}>
              {d ? <path d={d} className={cn("fill-chart-1 transition-opacity", active !== null && !isActive && "opacity-50")} /> : null}
              {i === peak && m.amountMinor > 0 && active === null ? (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-foreground text-[10px] font-bold tabular">
                  {formatMoney(m.amountMinor, { currency: data.currency }).replace(/,\d{2}$/, "")}
                </text>
              ) : null}
              <text x={i * band + band / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {monthName(m.month, "short")}
              </text>
              {/* Área de toque maior que a coluna (a faixa inteira). */}
              <rect
                x={i * band}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${monthName(m.month, "long")}: ${money(m.amountMinor)}`}
                className="cursor-pointer outline-none focus-visible:stroke-ring focus-visible:stroke-2"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive((v) => (v === i ? null : i))}
              />
            </g>
          );
        })}
      </svg>
    </section>
  );
}

type MeterRow = { key: string; label: string; valueMinor: number; detail?: string };

/** Lista com barra: nome, barra alinhada e valor escrito (ranqueada do maior para o menor). */
function MeterCard({ title, hint, rows, currency, total }: { title: string; hint?: string; rows: MeterRow[]; currency: string; total: number }) {
  const max = Math.max(...rows.map((r) => r.valueMinor), 1);
  const titleId = useId();
  return (
    <section className="bg-card shadow-card rounded-2xl border p-4" aria-labelledby={titleId}>
      <h3 id={titleId} className="text-sm font-bold">
        {title}
      </h3>
      {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
      <ul className="mt-3 space-y-3">
        {rows.map((r) => {
          const share = total > 0 ? Math.round((r.valueMinor / total) * 100) : 0;
          return (
            <li key={r.key}>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                <span className="tabular font-bold">{formatMoney(r.valueMinor, { currency })}</span>
                <span className="text-muted-foreground tabular w-9 text-right text-xs">{share}%</span>
              </div>
              <div className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full" aria-hidden="true">
                <div className="bg-chart-1 h-full rounded-full" style={{ width: `${Math.max(2, (r.valueMinor / max) * 100)}%` }} />
              </div>
              {r.detail ? <p className="text-muted-foreground mt-1 text-xs">{r.detail}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SpendingTable({ data }: { data: GroupSpending }) {
  const money = (v: number) => formatMoney(v, { currency: data.currency });
  const th = "text-muted-foreground px-3 py-2 text-left text-xs font-semibold";
  const td = "px-3 py-2 text-sm";
  return (
    <div className="space-y-4">
      <table className="bg-card shadow-card w-full overflow-hidden rounded-2xl border">
        <caption className="sr-only">Gastos por mês</caption>
        <thead>
          <tr>
            <th className={th}>Mês</th>
            <th className={cn(th, "text-right")}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.byMonth.map((m) => (
            <tr key={m.month}>
              <td className={td}>{monthName(m.month, "long")}</td>
              <td className={cn(td, "tabular text-right font-semibold")}>{money(m.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="bg-card shadow-card w-full overflow-hidden rounded-2xl border">
        <caption className="sr-only">Gastos por categoria</caption>
        <thead>
          <tr>
            <th className={th}>Categoria</th>
            <th className={cn(th, "text-right")}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.byCategory.map((c) => (
            <tr key={c.category}>
              <td className={td}>{expenseCategories[c.category as ExpenseCategory]?.label ?? c.category}</td>
              <td className={cn(td, "tabular text-right font-semibold")}>{money(c.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="bg-card shadow-card w-full overflow-hidden rounded-2xl border">
        <caption className="sr-only">Parte e pagamentos de cada pessoa</caption>
        <thead>
          <tr>
            <th className={th}>Pessoa</th>
            <th className={cn(th, "text-right")}>Parte</th>
            <th className={cn(th, "text-right")}>Pagou</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.byMember.map((m) => (
            <tr key={m.memberId}>
              <td className={td}>{m.memberId === data.viewerMemberId ? "Você" : m.name}</td>
              <td className={cn(td, "tabular text-right font-semibold")}>{money(m.shareMinor)}</td>
              <td className={cn(td, "tabular text-right")}>{money(m.paidMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
