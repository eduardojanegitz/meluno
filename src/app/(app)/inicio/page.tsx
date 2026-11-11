import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireViewer } from "@/server/auth/session";

export const metadata: Metadata = { title: "Início" };

/**
 * Página provisória (Etapa 3): confirma a sessão real do usuário.
 * O dashboard completo é construído na Etapa 4.
 */
export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <Logo size="sm" />
      <Suspense fallback={<Skeleton className="mt-8 h-24 w-full rounded-2xl" />}>
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const viewer = await requireViewer();
  const first = viewer.name.split(/\s+/)[0];
  return (
    <section className="bg-card shadow-card mt-8 rounded-2xl border p-5">
      <h1 className="text-2xl font-extrabold">Olá, {first}!</h1>
      <p className="text-muted-foreground mt-1 text-sm">Sua conta está ativa. O painel de grupos e saldos chega na próxima etapa.</p>
      <div className="mt-5">
        <SignOutButton />
      </div>
    </section>
  );
}
