import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Tamanho visual do wordmark. */
  size?: "sm" | "md" | "lg" | "xl";
};

const sizes = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-6xl",
} as const;

/**
 * Wordmark "meluno." — o ponto final é a assinatura da marca:
 * conta fechada, assunto resolvido.
 */
export function Logo({ className, size = "md" }: LogoProps) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-baseline font-extrabold leading-none tracking-[-0.045em] select-none",
        sizes[size],
        className,
      )}
    >
      <span className="sr-only">Meluno</span>
      <span aria-hidden="true">meluno</span>
      <span
        aria-hidden="true"
        className="bg-brand-dot ml-[0.06em] inline-block size-[0.24em] translate-y-[-0.02em] rounded-full"
      />
    </span>
  );
}

/** Símbolo do app: o ponto sobre a base azul profunda. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Meluno" className={cn("size-10", className)}>
      <rect width="64" height="64" rx="16" fill="#172D40" />
      <path
        d="M17 44V30.5a6.5 6.5 0 0 1 13 0V44M30 30.5a6.5 6.5 0 0 1 13 0V44"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="51" cy="41.5" r="4" fill="#B7F7D5" />
    </svg>
  );
}
