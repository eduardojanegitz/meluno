"use client";

import { motion } from "motion/react";
import { Equal, Hash, ListChecks, Percent, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

export const splitMethods = {
  EQUAL: { label: "Igual", icon: Equal },
  EXACT: { label: "Valores", icon: Hash },
  PERCENT: { label: "Porcent.", icon: Percent },
  SHARES: { label: "Partes", icon: PieChart },
  ITEMS: { label: "Itens", icon: ListChecks },
} as const;

export type SplitMethod = keyof typeof splitMethods;

type SplitMethodPickerProps = {
  value: SplitMethod;
  onChange: (value: SplitMethod) => void;
  className?: string;
};

/** Controle segmentado para o tipo de divisão (radiogroup acessível). */
export function SplitMethodPicker({ value, onChange, className }: SplitMethodPickerProps) {
  const keys = Object.keys(splitMethods) as SplitMethod[];
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de divisão"
      className={cn("bg-muted grid grid-cols-5 gap-1 rounded-2xl p-1", className)}
      onKeyDown={(e) => {
        const i = keys.indexOf(value);
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const next = keys[(i + (e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length]!;
          onChange(next);
          (e.currentTarget.querySelector(`[data-value="${next}"]`) as HTMLElement | null)?.focus();
        }
      }}
    >
      {keys.map((key) => {
        const { label, icon: Icon } = splitMethods[key];
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-value={key}
            onClick={() => onChange(key)}
            className={cn(
              "focus-visible:ring-ring relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition-colors outline-none focus-visible:ring-2 sm:h-10 sm:flex-row sm:gap-1.5 sm:text-sm",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="split-method-active"
                className="bg-card shadow-card absolute inset-0 rounded-xl"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            ) : null}
            <Icon className="relative size-4" aria-hidden="true" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
