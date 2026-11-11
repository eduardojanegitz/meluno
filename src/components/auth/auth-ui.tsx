"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, CircleAlert, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[28px] leading-tight font-extrabold">{title}</h1>
      {description ? <p className="text-muted-foreground mt-2 text-[15px]">{description}</p> : null}
    </div>
  );
}

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Campo com rótulo, mensagem de erro associada (aria-describedby) e dica opcional. */
export function Field({ label, error, hint, id, type, className, ...props }: FieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        <Input
          id={fieldId}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
          className={isPassword ? "pr-12" : undefined}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
            aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={reveal}
          >
            {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-destructive animate-in fade-in-0 slide-in-from-top-1 text-sm duration-200">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "success" }) {
  const Icon = tone === "error" ? CircleAlert : MailCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-1 flex gap-2.5 rounded-xl px-3.5 py-3 text-sm duration-200",
        tone === "error" ? "bg-negative-soft text-negative" : "bg-positive-soft text-positive",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground my-6 flex items-center gap-3 text-xs">
      <span className="bg-border h-px flex-1" />
      {children}
      <span className="bg-border h-px flex-1" />
    </div>
  );
}

/** Ícone oficial do Google ("G" multicolor), exigido pelas diretrizes de marca do botão. */
export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}
