"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Melu } from "@/components/brand/melu";
import { Button } from "@/components/ui/button";

/** Erro inesperado numa página: avisa o servidor (sem dados pessoais) e oferece tentar de novo. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/erros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: error.name, message: error.message, digest: error.digest, path: location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 px-4 text-center">
      <Melu mood="worried" size={104} />
      <div className="max-w-sm space-y-2">
        <h1 className="text-2xl font-black">Algo deu errado por aqui</h1>
        <p className="text-muted-foreground">Já fomos avisados. Seus dados estão salvos; tente de novo em instantes.</p>
        {error.digest ? <p className="text-muted-foreground font-mono text-xs">Código: {error.digest}</p> : null}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>Tentar de novo</Button>
        <Button asChild variant="outline">
          <Link href="/inicio">Ir para o início</Link>
        </Button>
      </div>
    </main>
  );
}
