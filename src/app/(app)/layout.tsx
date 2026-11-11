import { Suspense } from "react";
import { DesktopSidebar, DesktopSidebarView, MobileNav, MobileNavView } from "@/components/app/app-nav";

/**
 * Casca do app autenticado. É estática (prerenderizada); a navegação marca a
 * rota ativa depois (lê a URL dentro de <Suspense>) e tudo que depende da
 * sessão vive dentro de <Suspense> nas páginas.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<DesktopSidebarView pathname="" />}>
        <DesktopSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-10">{children}</div>
      <Suspense fallback={<MobileNavView pathname="" />}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
