"use client";

import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { toneClass, toneFor, type MoneyTone } from "./money";

type AnimatedMoneyProps = {
  amountMinor: number;
  currency?: string;
  tone?: MoneyTone;
  absolute?: boolean;
  className?: string;
};

/**
 * Anima a transição entre valores. A animação interpola centavos inteiros
 * apenas para exibição; o valor final exibido é sempre o valor exato recebido.
 */
export function AnimatedMoney({ amountMinor, currency, tone = "neutral", absolute, className }: AnimatedMoneyProps) {
  const reduce = useReducedMotion();
  const target = absolute ? Math.abs(amountMinor) : amountMinor;
  const mv = useMotionValue(target);
  const [display, setDisplay] = useState(target);

  useMotionValueEvent(mv, "change", (v) => setDisplay(Math.round(v)));

  useEffect(() => {
    if (reduce) {
      mv.jump(target);
      return;
    }
    const controls = animate(mv, target, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [target, reduce, mv]);

  return (
    <span
      className={cn("tabular whitespace-nowrap", toneClass[toneFor(amountMinor, tone)], className)}
      aria-live="polite"
    >
      <span aria-hidden="true">{formatMoney(display, { currency })}</span>
      <span className="sr-only">{formatMoney(target, { currency })}</span>
    </span>
  );
}
