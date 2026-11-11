import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Melu } from "@/components/brand/melu";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Não encontrado", robots: { index: false } };

/** Também aparece para grupos e despesas de outras pessoas: não revela se existem. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo size="md" />
      <Melu mood="thinking" size={104} />
      <div className="max-w-sm space-y-2">
        <h1 className="text-2xl font-black">Não encontramos essa página</h1>
        <p className="text-muted-foreground">O link pode estar errado, ou isso não está disponível para a sua conta.</p>
      </div>
      <Button asChild>
        <Link href="/inicio">Ir para o início</Link>
      </Button>
    </main>
  );
}
