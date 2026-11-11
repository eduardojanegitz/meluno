import { Logo } from "@/components/brand/logo";

/** Placeholder até a landing page (Etapa 5). */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <Logo size="lg" />
      <p className="text-muted-foreground">Compartilhe momentos. Não complicações.</p>
    </main>
  );
}
