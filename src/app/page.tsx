import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Divide, HandCoins, Link2, ListChecks, ShieldCheck, Sparkles, UserPlus, Users, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LogoMorph } from "@/components/brand/logo-morph";
import { Melu } from "@/components/brand/melu";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { Money } from "@/components/money/money";

export const metadata: Metadata = {
  title: { absolute: "Meluno — Compartilhe momentos. Não complicações." },
  alternates: { canonical: "/" },
};

const steps = [
  { icon: Users, title: "Junte a turma", text: "Viagem, casa, churrasco de sábado. Dá pra adicionar quem ainda nem baixou nada." },
  { icon: ListChecks, title: "Anote quem pagou", text: "Mercado, Uber, aquele vinho. Divide igual, por valor, por porcentagem ou por partes." },
  { icon: HandCoins, title: "Fecha a conta", text: "O Meluno faz a matemática e mostra o menor número de Pix pra todo mundo ficar quite." },
];

const features = [
  { icon: Divide, title: "Centavo por centavo", text: "A conta fecha no centavo. E o centavo que sobra vai rodando entre a turma, pra ninguém sair no prejuízo sempre." },
  { icon: Sparkles, title: "Menos transferências", text: "Nada de cinco Pix cruzados. Você vê só os pagamentos que precisam acontecer." },
  { icon: UserPlus, title: "Chama quem quiser", text: "Comece antes de a pessoa entrar. Quando ela aceitar o convite, tá tudo lá esperando." },
  { icon: Link2, title: "Pix à mão", text: "Deixe sua chave Pix salva e quem te deve copia com um toque. O dinheiro vai direto, o Meluno não toca nele." },
  { icon: ShieldCheck, title: "Privado por padrão", text: "Grupo é coisa de quem tá nele. Ninguém de fora vê seus gastos ou suas chaves." },
  { icon: Smartphone, title: "Feito para o celular", text: "Fica na tela inicial como um app. Tem modo escuro e funciona no computador também." },
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
            <p className="text-[56px] sm:text-7xl">
              <LogoMorph mood="happy" delay={900} />
            </p>
            <h1 className="mt-6 text-[34px] leading-[1.08] font-black tracking-[-0.02em] text-balance sm:text-5xl">
              Compartilhe momentos.
              <br />
              <span className="text-positive">Não complicações.</span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg text-pretty">
              Viagem, casa, rolê. Você anota os gastos, o Meluno faz as contas e mostra quem deve quanto pra quem. Sem planilha e sem climão.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/criar-conta">
                  Bora começar <ArrowRight />
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
            <h2 id="como-funciona" className="text-3xl font-black sm:text-4xl">
              Três passos e pronto
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="bg-ink font-display dark:bg-mint dark:text-mint-foreground flex size-8 items-center justify-center rounded-full text-sm font-black text-white">{i + 1}</span>
                  <span className={`${["bg-mint", "bg-sun", "bg-coral"][i]} text-ink mt-3 flex size-14 -rotate-3 items-center justify-center rounded-2xl shadow-[0_4px_0_rgb(0_0_0/0.12)]`}>
                    <s.icon className="size-6" strokeWidth={2.25} aria-hidden="true" />
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
          <h2 id="recursos" className="max-w-2xl text-3xl font-black text-balance sm:text-4xl">
            Conta certa, conversa leve.
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <li key={f.title} className="bg-card shadow-card rounded-3xl border-2 p-6 transition-transform hover:-translate-y-1 hover:-rotate-[0.5deg]">
                <span className={`${["bg-mint", "bg-sun", "bg-grape/30", "bg-coral/40", "bg-mint", "bg-sun"][i]} text-ink flex size-11 items-center justify-center rounded-xl`}>
                  <f.icon className="size-5" strokeWidth={2.25} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-extrabold">{f.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-20 sm:px-8">
          <div className="bg-ink relative mx-auto max-w-6xl overflow-hidden rounded-[32px] px-6 pt-14 pb-12 text-center text-white sm:px-12 dark:border-2 dark:border-[#243d50]">
            <Melu mood="celebrate" size={112} className="mx-auto" />
            <h2 className="mt-4 text-3xl font-black text-balance sm:text-4xl">
              A próxima conta já chega dividida<span className="text-mint">.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/75">Leva menos de um minuto. Depois é só chamar a turma.</p>
            <Button asChild size="lg" variant="mint" className="mt-8">
              <Link href="/criar-conta">
                Criar minha conta <ArrowRight />
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
    <figure className="animate-in fade-in slide-in-from-bottom-6 relative mx-auto mt-10 w-full max-w-sm duration-1000 lg:mt-0 lg:max-w-md" aria-label="Exemplo ilustrativo de um grupo no Meluno">
      <div className="bg-sun absolute -top-4 -right-3 -z-10 size-24 rounded-full" aria-hidden="true" />
      <div className="bg-coral/50 absolute -bottom-5 -left-4 -z-10 size-16 rotate-12 rounded-[22px]" aria-hidden="true" />
      <div className="absolute -top-14 -left-3 z-10 sm:-left-8" aria-hidden="true">
        <Melu mood="celebrate" size={84} />
      </div>
      <div className="bg-card shadow-float rotate-[1.5deg] rounded-[32px] border-2 p-5" aria-hidden="true">
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
