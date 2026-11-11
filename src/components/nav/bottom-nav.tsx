"use client";

import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

type BottomNavProps = {
  items: NavItem[];
  activeHref: string;
  onAdd?: () => void;
  /** Renderiza cada link — permite usar <Link> no app e botões na vitrine. */
  renderLink?: (item: NavItem, children: React.ReactNode, className: string) => React.ReactNode;
  className?: string;
};

/**
 * Navegação mobile: 4 destinos + ação central de nova despesa,
 * posicionada na zona de alcance do polegar.
 */
export function BottomNav({ items, activeHref, onAdd, renderLink, className }: BottomNavProps) {
  const [left, right] = [items.slice(0, 2), items.slice(2)];

  const renderItem = (item: NavItem) => {
    const active = activeHref === item.href;
    const Icon = item.icon;
    const content = (
      <>
        <span className="relative flex h-8 w-14 items-center justify-center">
          {active ? (
            <motion.span
              layoutId="bottom-nav-pill"
              className="bg-mint/70 dark:bg-mint/15 absolute inset-0 rounded-full"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          ) : null}
          <Icon className="relative size-[22px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
        </span>
        <span className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}>{item.label}</span>
      </>
    );
    const cls = cn(
      "flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl",
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
    );
    return (
      <li key={item.href} className="flex flex-1">
        {renderLink ? (
          renderLink(item, content, cls)
        ) : (
          <a href={item.href} className={cls} aria-current={active ? "page" : undefined}>
            {content}
          </a>
        )}
      </li>
    );
  };

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("bg-card/90 border-border/70 pb-safe border-t backdrop-blur-lg", className)}
    >
      <ul className="mx-auto flex max-w-md items-end px-2 pt-1.5 pb-1">
        {left.map(renderItem)}
        <li className="flex flex-1 justify-center">
          <motion.button
            type="button"
            onClick={onAdd}
            whileTap={{ scale: 0.92 }}
            className="bg-primary text-primary-foreground shadow-float focus-visible:ring-ring -mt-6 flex size-14 items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            aria-label="Nova despesa"
          >
            <Plus className="size-6" strokeWidth={2.5} aria-hidden="true" />
          </motion.button>
        </li>
        {right.map(renderItem)}
      </ul>
    </nav>
  );
}
