"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Melu, type MeluMood } from "./melu";

type Props = {
  className?: string;
  /** Humor final do Melu. */
  mood?: MeluMood;
  /** Atraso (ms) antes do ponto ganhar vida. */
  delay?: number;
};

/**
 * Wordmark "meluno." em que o ponto final ganha vida e vira o Melu:
 * o ponto quica, estica e "desabrocha" em mascote. O texto usa o tamanho de
 * fonte do elemento pai (em), então escala junto com o título.
 *
 * Com "reduzir movimento", mostra direto o estado final.
 */
export function LogoMorph({ className, mood = "happy", delay = 700 }: Props) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<"dot" | "melu">("dot");

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setStage("melu"), delay);
    return () => clearTimeout(t);
  }, [reduce, delay]);

  const showMelu = reduce || stage === "melu";

  return (
    <span className={cn("font-display inline-flex items-end leading-none font-black tracking-[-0.04em] select-none", className)}>
      <span className="sr-only">Meluno</span>
      <span aria-hidden="true">meluno</span>
      <motion.span
        aria-hidden="true"
        className="relative inline-block"
        initial={false}
        animate={{ width: showMelu ? "1.05em" : "0.32em", height: showMelu ? "1.1em" : "0.24em" }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        <AnimatePresence initial={false}>
          {showMelu ? (
            <motion.span
              key="melu"
              className="absolute inset-x-0 bottom-[-0.06em] flex justify-center"
              initial={reduce ? false : { scale: 0.25, y: "0.1em", opacity: 0.6 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 14 }}
              style={{ originY: 1 }}
            >
              <Melu mood={mood} size={0} className="h-[1.15em] w-auto" />
            </motion.span>
          ) : (
            <motion.span
              key="dot"
              className="bg-brand-dot absolute bottom-[0.02em] left-[0.06em] size-[0.24em] rounded-full"
              animate={reduce ? undefined : { y: ["0em", "-0.35em", "0em", "-0.18em", "0em"], scaleX: [1, 0.85, 1.25, 0.9, 1], scaleY: [1, 1.15, 0.75, 1.1, 1] }}
              transition={{ duration: Math.max(delay, 300) / 1000, ease: "easeOut" }}
              exit={{ scale: 2.2, opacity: 0, transition: { duration: 0.18 } }}
            />
          )}
        </AnimatePresence>
      </motion.span>
    </span>
  );
}
