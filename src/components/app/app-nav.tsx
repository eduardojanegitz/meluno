"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { BottomNav } from "@/components/nav/bottom-nav";
import { navItems } from "@/components/nav/nav-items";

/** Destino do botão "+": dentro de um grupo, já abre a despesa naquele grupo. */
function newExpenseHref(pathname: string) {
  const match = pathname.match(/^\/grupos\/([0-9a-f-]{36})/);
  return match ? `/grupos/${match[1]}/despesas/nova` : "/nova-despesa";
}

function activeHref(pathname: string) {
  return navItems.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.href ?? "";
}

/** Lê a URL atual (precisa estar dentro de <Suspense>). */
export function MobileNav() {
  return <MobileNavView pathname={usePathname()} />;
}

export function MobileNavView({ pathname }: { pathname: string }) {
  const router = useRouter();
  // Formulários em tela cheia escondem a navegação.
  if (/\/(despesas\/nova|editar|acertar)$/.test(pathname) || pathname === "/grupos/novo") return null;
  return (
    <BottomNav
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      items={navItems}
      activeHref={activeHref(pathname)}
      onAdd={() => router.push(newExpenseHref(pathname))}
      renderLink={(item, children, className) => (
        <Link href={item.href} className={className} aria-current={activeHref(pathname) === item.href ? "page" : undefined}>
          {children}
        </Link>
      )}
    />
  );
}

export function DesktopSidebar() {
  return <DesktopSidebarView pathname={usePathname()} />;
}

/** Versão sem leitura de URL: usada como fallback estático durante o prerender. */
export function DesktopSidebarView({ pathname, footer }: { pathname: string; footer?: React.ReactNode }) {
  const active = activeHref(pathname);
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-4 py-6 md:flex">
      <Link href="/inicio" className="focus-visible:ring-ring mb-8 rounded-lg px-2 outline-none focus-visible:ring-2" aria-label="Meluno — início">
        <Logo size="md" />
      </Link>
      <Link
        href={newExpenseHref(pathname)}
        className="bg-primary text-primary-foreground focus-visible:ring-ring shadow-float mb-6 flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold transition-transform outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        <Plus className="size-5" aria-hidden="true" /> Nova despesa
      </Link>
      <nav aria-label="Navegação principal">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors outline-none focus-visible:ring-2",
                    isActive ? "bg-mint/60 dark:bg-mint/15 text-foreground font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto">{footer}</div>
    </aside>
  );
}
