import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

type PageHeaderProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  /** Mostra o logo no mobile (telas raiz). */
  brand?: boolean;
  className?: string;
};

export function PageHeader({ title, subtitle, backHref, backLabel = "Voltar", actions, brand, className }: PageHeaderProps) {
  return (
    <header className={cn("mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6 md:pt-8", className)}>
      <div className="flex min-h-11 items-center gap-2">
        {backHref ? (
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring -ml-2 flex size-11 items-center justify-center rounded-xl outline-none focus-visible:ring-2"
            aria-label={backLabel}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
        {brand ? (
          <Link href="/inicio" className="md:hidden" aria-label="Meluno — início">
            <Logo size="sm" />
          </Link>
        ) : null}
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      </div>
      {title ? (
        <div className="mt-2">
          <h1 className="text-[26px] leading-tight font-extrabold md:text-3xl">{title}</h1>
          {subtitle ? <div className="text-muted-foreground mt-1 text-sm">{subtitle}</div> : null}
        </div>
      ) : null}
    </header>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-3xl flex-1 px-4 pt-5 sm:px-6", className)}>{children}</main>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-muted-foreground text-[13px] font-semibold tracking-wide uppercase">{children}</h2>
      {action}
    </div>
  );
}
