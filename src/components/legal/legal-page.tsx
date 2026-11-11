import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LEGAL, legalDraft } from "@/lib/legal";

/** Moldura das páginas legais: legível, sem distrações, imprimível. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" aria-label="Meluno — página inicial" className="focus-visible:ring-ring rounded-lg outline-none focus-visible:ring-2">
          <Logo size="sm" />
        </Link>
        <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold">
          <ArrowLeft className="size-4" aria-hidden="true" /> Voltar
        </Link>
      </header>
      {legalDraft ? (
        <p role="note" className="bg-warning-soft mb-6 rounded-xl px-4 py-3 text-sm font-semibold">
          Rascunho: os dados do responsável ainda não foram preenchidos (src/lib/legal.ts). Revise o texto com um advogado antes de publicar.
        </p>
      ) : null}
      <main>
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Última atualização: {LEGAL.updatedAt}</p>
        <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-extrabold [&_li]:mt-1.5 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4">
          {children}
        </div>
      </main>
    </div>
  );
}
