"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const options = [
  { value: "system", label: "Automático", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
] as const;

export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className="bg-muted grid grid-cols-3 gap-1 rounded-2xl p-1">
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            onClick={() => setTheme(o.value)}
            suppressHydrationWarning
            className={cn(
              "focus-visible:ring-ring flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium outline-none focus-visible:ring-2",
              "text-muted-foreground aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-card",
            )}
          >
            <Icon className="size-4" aria-hidden="true" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}
