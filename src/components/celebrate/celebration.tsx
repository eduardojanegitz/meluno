"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Melu, type MeluMood } from "@/components/brand/melu";

/**
 * Celebrações estilo "conquista": o Melu aparece com confete por ~2s.
 * Uso: celebrate({ title: "Tudo quite!", mood: "celebrate", big: true }).
 *
 * - Um único <CelebrationHost/> (no Providers) renderiza a fila.
 * - Com "reduzir movimento", sem confete e sem pulos: só o cartão.
 * - Anunciada a leitores de tela (role="status").
 */
export type Celebration = {
  title: string;
  subtitle?: string;
  mood?: MeluMood;
  /** Momentos grandes (grupo zerado, primeiro grupo) ganham confete. */
  big?: boolean;
};

type Entry = Celebration & { id: number };

let current: Entry | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function celebrate(c: Celebration) {
  clearTimeout(timer);
  current = { ...c, id: ++seq };
  emit();
  haptic(c.big ? "success" : "light");
  timer = setTimeout(dismiss, c.big ? 2600 : 1700);
}

function dismiss() {
  current = null;
  emit();
}

/** Vibração curta onde o aparelho suporta (Android). No iOS é ignorada. */
export function haptic(kind: "light" | "success" | "warning" = "light") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(kind === "success" ? [12, 60, 18] : kind === "warning" ? [30, 40, 30] : 10);
  } catch {
    /* alguns navegadores bloqueiam sem interação recente */
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function CelebrationHost() {
  const entry = useSyncExternalStore(subscribe, () => current, () => null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center" role="status" aria-live="polite">
      {/* Sem animação de saída de propósito: um exit travado deixaria a camada
          invisível bloqueando os toques. Ao fechar, o overlay sai do DOM na hora. */}
      {entry ? (
          <motion.div key={entry.id} className="pointer-events-auto absolute inset-0 flex items-center justify-center" onClick={dismiss} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-ink/25 absolute inset-0 backdrop-blur-[2px]" aria-hidden="true" />
            {entry.big && !reduce ? <Confetti seed={entry.id} /> : null}
            <motion.div
              className="bg-card relative mx-6 flex max-w-xs flex-col items-center rounded-[28px] border-2 px-8 pt-6 pb-7 text-center shadow-float"
              initial={reduce ? { opacity: 0 } : { scale: 0.6, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 20 }}
            >
              <motion.div initial={reduce ? false : { y: 20, scale: 0.5 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 12, delay: 0.05 }}>
                <Melu mood={entry.mood ?? "celebrate"} size={entry.big ? 120 : 96} />
              </motion.div>
              <p className="font-display mt-2 text-2xl font-black">{entry.title}</p>
              {entry.subtitle ? <p className="text-muted-foreground mt-1 text-sm">{entry.subtitle}</p> : null}
            </motion.div>
          </motion.div>
        ) : null}
    </div>
  );
}

const COLORS = ["#3FCF8E", "#7EE8B5", "#FF7A6B", "#FFC94A", "#8B7BFF", "#7FC4FF"];

/** Peças de confete determinísticas a partir da semente (gerador linear simples). */
function makePieces(seed: number) {
    let x = seed * 9301 + 49297;
    const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 44 }, (_, i) => ({
      i,
      left: rnd() * 100,
      dx: (rnd() - 0.5) * 240,
      rot: (rnd() - 0.5) * 900,
      delay: rnd() * 0.25,
      dur: 1.6 + rnd() * 0.9,
      w: 6 + rnd() * 6,
      h: 8 + rnd() * 8,
      round: rnd() > 0.6,
      color: COLORS[i % COLORS.length],
    }));
}

/** Confete leve: ~44 peças animadas com motion (sem canvas, sem dependência). */
function Confetti({ seed }: { seed: number }) {
  const pieces = useMemo(() => makePieces(seed), [seed]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className="absolute top-[-4%] block"
          style={{ left: `${p.left}%`, width: p.w, height: p.round ? p.w : p.h, background: p.color, borderRadius: p.round ? 999 : 3 }}
          initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", x: p.dx, rotate: p.rot, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.dur, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
