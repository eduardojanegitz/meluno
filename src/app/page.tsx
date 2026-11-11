import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Divide, HandCoins, Link2, ListChecks, ShieldCheck, Sparkles, UserPlus, Users, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { Money } from "@/components/money/money";

export const metadata: Metadata = {
  title: { absolute: "Meluno — Compartilhe momentos. Não complicações." },
  alternates: { canonical: "/" },
};

const steps = [
  { icon: Users, title: "Crie um grupo", text: "Viagem, casa, rolê do fim de semana. Adicione as pessoas, mesmo quem ainda não tem conta." },
  { icon: ListChecks, title: "Registre os gastos", text: "Quem pagou, quanto e como dividir: igual, por valor, porcentagem ou partes." },
  { icon: HandCoins, title: "Acerte em poucos passos", text: "O Meluno calcula o menor número de pagamentos para zerar tudo." },
];

const features = [
  { icon: Divide, title: "Centavo por centavo", text: "As divisões sempre fecham no valor exato. O centavo que sobra alterna entre as pessoas, sem favorecer ninguém." },
  { icon: Sparkles, title: "Menos transferências", text: "Em vez de todo mundo pagar todo mundo, você vê só os pagamentos que realmente precisam acontecer." },
  { icon: UserPlus, title: "Convite sem fricção", text: "Comece a dividir antes de a pessoa entrar. Quando ela aceitar o convite, o histórico já está lá." },
  { icon: Link2, title: "Pix à mão", text: "Cadastre suas chaves Pix e quem precisa te pagar copia com um toque. O Meluno não movimenta dinheiro." },
  { icon: ShieldCheck, title: "Privado por padrão", text: "Grupos, gastos e chaves Pix ficam visíveis só para quem participa do grupo." },
  { icon: Smartphone, title: "Feito para o celular", text: "Instale na tela inicial e use como um app. Tem modo escuro e funciona bem no computador também." },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="Meluno — página inicial" className="focus-visible:ring-ring rounded-lg outline-none focus-visible:ring-2">
          <Logo size="sm" />
        </Link>
        <nav aria-label="Conta" className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/entrar">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/criar-conta">Criar conta</Link>
          </Button>
        </nav>
      </header>

      <main id="conteudo" className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-8 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
            <p className="bg-secondary text-secondary-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
              <span className="bg-brand-dot size-1.5 rounded-full" aria-hidden="true" />
              Divisão de gastos em grupo
            </p>
            <h1 className="mt-5 text-[40px] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
              Compartilhe momentos.
              <br />
              <span className="text-muted-foreground">Não complicações.</span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg text-pretty">
              Organize gastos em grupo, divida contas do jeito certo e descubra quem deve para quem, sem planilha e sem climão.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/criar-conta">
                  Começar agora <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/entrar">Já tenho conta</Link>
              </Button>
            </div>
          </div>

          <HeroIllustration />
        </section>

        {/* Como funciona */}
        <section aria-labelledby="como-funciona" className="bg-card border-y">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8">
            <h2 id="como-funciona" className="text-3xl font-extrabold sm:text-4xl">
              Como funciona
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="text-muted-foreground font-display text-sm font-bold">0{i + 1}</span>
                  <span className="bg-mint text-mint-foreground mt-2 flex size-12 items-center justify-center rounded-2xl">
                    <s.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                  <p className="text-muted-foreground mt-1.5">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Recursos */}
        <section aria-labelledby="recursos" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8">
          <h2 id="recursos" className="max-w-2xl text-3xl font-extrabold text-balance sm:text-4xl">
            Conta certa, conversa leve.
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title} className="bg-card shadow-card rounded-3xl border p-6">
                <f.icon className="text-positive size-6" aria-hidden="true" />
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-20 sm:px-8">
          <div className="bg-ink dark:bg-card mx-auto max-w-6xl overflow-hidden rounded-[32px] px-6 py-14 text-center text-white sm:px-12 dark:border dark:text-foreground">
            <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">
              A próxima conta já chega dividida<span className="text-mint">.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/75 dark:text-muted-foreground">Crie sua conta em menos de um minuto e convide sua turma.</p>
            <Button asChild size="lg" variant="mint" className="mt-8">
              <Link href="/criar-conta">
                Criar conta <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 border-t px-4 py-8 text-sm sm:flex-row sm:px-8">
        <Logo size="sm" className="text-foreground" />
        <p className="text-center">O Meluno organiza contas; não processa pagamentos.</p>
      </footer>
    </div>
  );
}

/** Ilustração estática da interface (valores fictícios, marcados como exemplo). */
function HeroIllustration() {
  const people = [
    { id: "ex-ana", name: "Ana", amount: 8650 },
    { id: "ex-bruno", name: "Bruno", amount: -5320 },
    { id: "ex-carla", name: "Carla", amount: -3330 },
  ];
  return (
    <figure className="animate-in fade-in slide-in-from-bottom-6 relative mx-auto w-full max-w-sm duration-1000 lg:max-w-md" aria-label="Exemplo ilustrativo de um grupo no Meluno">
      <div className="bg-mint/40 absolute -inset-6 -z-10 rounded-[48px] blur-2xl dark:bg-mint/10" aria-hidden="true" />
      <div className="bg-card shadow-float rounded-[32px] border p-5" aria-hidden="true">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium">Grupo</p>
            <p className="font-display text-lg font-bold">Casa na praia</p>
          </div>
          <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-semibold">Exemplo</span>
        </div>

        <div className="bg-positive-soft mt-4 rounded-2xl p-4">
          <p className="text-positive text-xs font-semibold">Você tem a receber</p>
          <Money amountMinor={8650} currency="BRL" tone="positive" className="font-display text-3xl font-extrabold tracking-tight" />
        </div>

        <ul className="mt-4 space-y-1">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
              <MemberAvatar name={p.name} colorKey={p.id} size="sm" />
              <span className="flex-1 text-sm font-medium">{p.id === "ex-ana" ? "Você" : p.name}</span>
              <Money amountMinor={p.amount} currency="BRL" tone="auto" signed className="text-sm font-semibold" />
            </li>
          ))}
        </ul>

        <div className="bg-secondary mt-3 rounded-2xl p-3">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Para zerar</p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">Bruno</span> paga <Money amountMinor={5320} currency="BRL" className="font-semibold" /> para você
          </p>
          <p className="text-sm">
            <span className="font-semibold">Carla</span> paga <Money amountMinor={3330} currency="BRL" className="font-semibold" /> para você
          </p>
        </div>
      </div>
      <figcaption className="sr-only">Ilustração com valores fictícios.</figcaption>
    </figure>
  );
}
