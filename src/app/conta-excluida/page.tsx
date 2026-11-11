import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Melu } from "@/components/brand/melu";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conta excluída", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo size="md" />
      <Melu mood="worried" size={104} />
      <div className="max-w-sm space-y-2">
        <h1 className="text-2xl font-black">Sua conta foi excluída</h1>
        <p className="text-muted-foreground">
          Vou sentir sua falta. Seus dados pessoais foram apagados; nos grupos, os gastos continuam como “Usuário removido”.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
