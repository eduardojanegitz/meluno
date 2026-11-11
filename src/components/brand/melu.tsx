"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Melu — o mascote do Meluno. Nasceu do ponto final do logo ("meluno."):
 * corpo redondo menta (o ponto), com bico, asinhas, barriga e topete.
 *
 * Desenho em SVG próprio (viewBox centrado na origem). As cores são fixas
 * de propósito: o mascote é o mesmo nos temas claro e escuro.
 */
export type MeluMood = "happy" | "celebrate" | "thinking" | "worried" | "sleeping";

const C = {
  body: "#7EE8B5",
  shade: "#5FD39C",
  belly: "#E4FBEF",
  tuft: "#3FCF8E",
  beak: "#FFB547",
  ink: "#172D40",
  cheek: "#FF7A6B",
  grape: "#8B7BFF",
  sun: "#FFC94A",
  tear: "#7FC4FF",
} as const;

type MeluProps = {
  mood?: MeluMood;
  /** Largura em px; 0 deixa o tamanho para o CSS. */
  size?: number;
  className?: string;
  /** Movimento contínuo (respirar, piscar, bater asas). Desligue em listas. */
  animated?: boolean;
  /** Texto alternativo; sem ele o mascote é decorativo. */
  label?: string;
};

export function Melu({ mood = "happy", size = 96, className, animated = true, label }: MeluProps) {
  const reduce = useReducedMotion();
  const live = animated && !reduce;
  const blinking = useBlink(live && mood !== "sleeping");

  const loop = (duration: number, delay = 0): Transition => ({ duration, delay, repeat: Infinity, ease: "easeInOut" });

  return (
    <svg
      viewBox="-70 -80 140 150"
      // size 0 = dimensionado por CSS (className).
      width={size || undefined}
      height={size ? (size * 150) / 140 : undefined}
      className={cn("shrink-0 overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ellipse cx="0" cy="58" rx="34" ry="6" fill="#000" opacity=".08" />
      <motion.g
        animate={
          !live
            ? undefined
            : mood === "celebrate"
              ? { y: [0, -14, 0], scaleY: [1, 1.04, 0.94, 1] }
              : mood === "sleeping"
                ? { scaleY: [1, 1.03, 1] }
                : { y: [0, -2, 0] }
        }
        transition={mood === "celebrate" ? loop(0.7) : loop(mood === "sleeping" ? 3 : 2.4)}
        style={{ originY: "100%" }}
      >
        {/* pés */}
        <rect x="-19" y="44" width="11" height="9" rx="4.5" fill={C.beak} />
        <rect x="8" y="44" width="11" height="9" rx="4.5" fill={C.beak} />
        {/* asas (atrás do corpo nas poses abertas) */}
        <Wings mood={mood} live={live} />
        {/* corpo */}
        <circle r="48" fill={C.body} />
        <path d="M-48 2a48 48 0 0 0 96 0" fill={C.shade} />
        <ellipse cx="0" cy="18" rx="27" ry="23" fill={C.belly} />
        <motion.path
          d="M-4-47q-6-14 6-18q-2 9 6 12q-6 2-12 6z"
          fill={C.tuft}
          animate={live ? { rotate: [0, 8, 0, -4, 0] } : undefined}
          transition={loop(3.2, 0.4)}
          style={{ originX: "0%", originY: "100%" }}
        />
        <Face mood={mood} blinking={blinking} />
        <Extras mood={mood} live={live} />
      </motion.g>
    </svg>
  );
}

function useBlink(enabled: boolean) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setClosed(true);
        t = setTimeout(() => {
          setClosed(false);
          schedule();
        }, 140);
      }, 2400 + Math.random() * 2600);
    };
    schedule();
    return () => clearTimeout(t);
  }, [enabled]);
  return enabled && closed;
}

function Wings({ mood, live }: { mood: MeluMood; live: boolean }) {
  if (mood === "celebrate") {
    return (
      <>
        <motion.path d="M-44-8q-20-14-18-34q14 6 22 26z" fill={C.shade} animate={live ? { rotate: [0, -18, 0] } : undefined} transition={{ duration: 0.35, repeat: Infinity }} style={{ originX: "100%", originY: "100%" }} />
        <motion.path d="M44-8q20-14 18-34q-14 6-22 26z" fill={C.shade} animate={live ? { rotate: [0, 18, 0] } : undefined} transition={{ duration: 0.35, repeat: Infinity }} style={{ originX: "0%", originY: "100%" }} />
      </>
    );
  }
  if (mood === "thinking") {
    return (
      <>
        <path d="M-47 0q-16 6-10 22q10 0 12-16z" fill={C.shade} />
        <path d="M40-2q14-12 4-30q-12 4-12 20z" fill={C.shade} />
      </>
    );
  }
  const tight = mood === "worried" || mood === "sleeping";
  return (
    <>
      <motion.path
        d={tight ? "M-47 2q-12 10-6 22q8-2 10-16z" : "M-47 0q-16 6-10 22q10 0 12-16z"}
        fill={C.shade}
        animate={live && !tight ? { rotate: [0, -10, 0] } : undefined}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3.5 }}
        style={{ originX: "100%", originY: "0%" }}
      />
      <path d={tight ? "M47 2q12 10 6 22q-8-2-10-16z" : "M47 0q16 6 10 22q-10 0-12-16z"} fill={C.shade} />
    </>
  );
}

function Face({ mood, blinking }: { mood: MeluMood; blinking: boolean }) {
  const cheeks = (
    <>
      <circle cx="-30" cy="6" r="6" fill={C.cheek} opacity=".55" />
      <circle cx="30" cy="6" r="6" fill={C.cheek} opacity=".55" />
    </>
  );
  const closedEyes = <path d="M-20-10q6 6 12 0M8-10q6 6 12 0" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />;

  switch (mood) {
    case "celebrate":
      return (
        <>
          <path d="M-21-12q7-9 14 0M7-12q7-9 14 0" fill="none" stroke={C.ink} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M-9-2q9 16 18 0z" fill={C.beak} />
          {cheeks}
        </>
      );
    case "thinking":
      return (
        <>
          {blinking ? closedEyes : (
            <>
              <circle cx="-12" cy="-14" r="6" fill={C.ink} />
              <circle cx="16" cy="-14" r="6" fill={C.ink} />
              <circle cx="-10" cy="-17" r="2" fill="#fff" />
              <circle cx="18" cy="-17" r="2" fill="#fff" />
            </>
          )}
          <path d="M-5 2q7 5 14 0" fill="none" stroke={C.beak} strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case "worried":
      return (
        <>
          {blinking ? closedEyes : (
            <>
              <ellipse cx="-14" cy="-10" rx="5.5" ry="7" fill={C.ink} />
              <ellipse cx="14" cy="-10" rx="5.5" ry="7" fill={C.ink} />
            </>
          )}
          <path d="M-24-24l14 5M24-24l-14 5" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M-7 6q7-6 14 0q-7 4-14 0z" fill={C.beak} />
        </>
      );
    case "sleeping":
      return (
        <>
          {closedEyes}
          <path d="M-7 2q7 10 14 0q-7-4-14 0z" fill={C.beak} />
          {cheeks}
        </>
      );
    default:
      return (
        <>
          {blinking ? closedEyes : (
            <>
              <ellipse cx="-14" cy="-12" rx="6" ry="7.5" fill={C.ink} />
              <ellipse cx="14" cy="-12" rx="6" ry="7.5" fill={C.ink} />
              <circle cx="-12" cy="-15" r="2.2" fill="#fff" />
              <circle cx="16" cy="-15" r="2.2" fill="#fff" />
            </>
          )}
          <path d="M-7-1q7 10 14 0q-7-4-14 0z" fill={C.beak} />
          {cheeks}
        </>
      );
  }
}

function Extras({ mood, live }: { mood: MeluMood; live: boolean }) {
  if (mood === "celebrate") {
    const bits = [
      { x: -62, y: -62, c: C.sun, d: 0 },
      { x: 64, y: -66, c: C.cheek, d: 0.15 },
      { x: -14, y: -88, c: C.grape, d: 0.3 },
      { x: 40, y: -92, c: C.tuft, d: 0.45 },
    ];
    return (
      <>
        {bits.map((b) => (
          <motion.rect
            key={`${b.x}`}
            x={b.x - 4}
            y={b.y - 4}
            width="8"
            height="8"
            rx="2"
            fill={b.c}
            animate={live ? { y: [0, -6, 0], rotate: [0, 90, 180], opacity: [1, 0.6, 1] } : undefined}
            transition={{ duration: 1.2, delay: b.d, repeat: Infinity }}
          />
        ))}
      </>
    );
  }
  if (mood === "thinking") {
    return (
      <motion.g animate={live ? { opacity: [0.4, 1, 0.4] } : undefined} transition={{ duration: 2, repeat: Infinity }}>
        <circle cx="58" cy="-52" r="5" fill="none" stroke={C.grape} strokeWidth="3" />
        <circle cx="70" cy="-70" r="8" fill="none" stroke={C.grape} strokeWidth="3" />
      </motion.g>
    );
  }
  if (mood === "worried") {
    return (
      <motion.path
        d="M42-34q8 10 0 16q-8-6 0-16z"
        fill={C.tear}
        animate={live ? { y: [0, 6, 0], opacity: [1, 0.5, 1] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
    );
  }
  if (mood === "sleeping") {
    return (
      <>
        {[
          { x: 36, y: -44, s: 20, d: 0 },
          { x: 52, y: -62, s: 14, d: 0.8 },
        ].map((z) => (
          <motion.text
            key={z.x}
            x={z.x}
            y={z.y}
            fontSize={z.s}
            fontWeight={900}
            fontFamily="var(--font-nunito), sans-serif"
            fill={C.grape}
            animate={live ? { y: [0, -8, 0], opacity: [0, 1, 0] } : undefined}
            transition={{ duration: 2.4, delay: z.d, repeat: Infinity }}
          >
            z
          </motion.text>
        ))}
      </>
    );
  }
  return null;
}
