import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conta excluída", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo size="md" />
      <div className="max-w-sm space-y-2">
        <h1 className="text-2xl font-extrabold">Sua conta foi excluída</h1>
        <p className="text-muted-foreground">
          Seus dados pessoais foram apagados. Nos grupos, os registros financeiros continuam como “Usuário removido”.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
