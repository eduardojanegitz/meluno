"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowLeftRight, Moon, Plus, ReceiptText, Sun, Trash2, UserPlus, Users } from "lucide-react";

import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Money } from "@/components/money/money";
import { AnimatedMoney } from "@/components/money/animated-money";
import { MoneyInput } from "@/components/money/money-input";
import { BalanceLabel } from "@/components/balance/balance-label";
import { MemberAvatar, MemberAvatarStack } from "@/components/member-avatar";
import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group/group-card";
import { ExpenseRow } from "@/components/expense/expense-row";
import { ActivityItem } from "@/components/activity/activity-item";
import { SplitMethodPicker, type SplitMethod } from "@/components/expense/split-method-picker";
import { BottomNav } from "@/components/nav/bottom-nav";
import { navItems } from "@/components/nav/nav-items";

/* Dados ilustrativos, exclusivos desta vitrine. */
const NOW = new Date(2026, 10, 10, 12);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const people = [
  { id: "m1", name: "João Pedro" },
  { id: "m2", name: "Maria Clara" },
  { id: "m3", name: "Pedro Henrique" },
  { id: "m4", name: "Ana Luiza" },
  { id: "m5", name: "Beatriz Lima" },
  { id: "m6", name: "Rafael Costa" },
];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t py-10 first:border-t-0">
      <h2 className="text-xl font-bold">{title}</h2>
      {description ? <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({ name, hex, className, note }: { name: string; hex: string; className: string; note?: string }) {
  return (
    <div className="bg-card overflow-hidden rounded-2xl border">
      <div className={`h-20 ${className}`} />
      <div className="p-3">
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-muted-foreground tabular font-mono text-xs uppercase">{hex}</p>
        {note ? <p className="text-muted-foreground mt-1 text-xs">{note}</p> : null}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Ícones alternados por CSS: evita divergência de hidratação (o tema só é conhecido no cliente).
  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar tema"
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

export function DesignShowcase() {
  const [amount, setAmount] = useState(15000);
  const [balance, setBalance] = useState(10000);
  const [method, setMethod] = useState<SplitMethod>("EQUAL");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("/inicio");
  const [items, setItems] = useState<string[]>([]);

  const sections = [
    ["marca", "Marca"],
    ["cores", "Cores"],
    ["tipografia", "Tipografia"],
    ["botoes", "Botões"],
    ["campos", "Campos"],
    ["saldos", "Saldos"],
    ["pessoas", "Pessoas"],
    ["listas", "Listas"],
    ["estados", "Estados"],
    ["feedback", "Feedback"],
    ["navegacao", "Navegação"],
  ] as const;

  return (
    <div className="min-h-dvh">
      <header className="bg-background/85 sticky top-0 z-30 border-b backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Logo size="sm" />
          <Badge variant="secondary">Design system</Badge>
          <nav className="ml-auto hidden gap-0.5 xl:flex" aria-label="Seções">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-2.5 py-1.5 text-sm">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto xl:ml-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <p className="bg-warning-soft text-warning mt-6 rounded-xl px-4 py-2.5 text-sm">
          Vitrine interna (apenas em desenvolvimento). Nomes e valores abaixo são ilustrativos.
        </p>

        {/* ───────────── Marca ───────────── */}
        <Section id="marca" title="Marca" description="Wordmark tipográfico em Plus Jakarta Sans ExtraBold. O ponto final é a assinatura: conta fechada, assunto resolvido.">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="bg-card flex min-h-48 items-center justify-center rounded-3xl border">
              <Logo size="xl" />
            </div>
            <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-3xl bg-[#172D40] text-white dark:ring-1 dark:ring-white/10">
              <Logo size="lg" className="[&>span:last-child]:bg-mint" />
              <p className="text-sm text-white/70">Compartilhe momentos. Não complicações.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <LogoMark className="size-20" />
            <LogoMark className="size-12" />
            <LogoMark className="size-8" />
            <p className="text-muted-foreground max-w-sm text-sm">
              Símbolo provisório para ícone do app e favicon: “m” com o ponto menta. Pode ser substituído por um símbolo exclusivo depois.
            </p>
          </div>
        </Section>

        {/* ───────────── Cores ───────────── */}
        <Section id="cores" title="Cores" description="Paleta da marca + cores semânticas financeiras. Verde = a receber, coral = você deve. O sentido sempre acompanha texto e ícone, nunca só a cor.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Swatch name="Ink" hex="#172D40" className="bg-[#172D40]" note="Marca, primário" />
            <Swatch name="Mint" hex="#B7F7D5" className="bg-[#B7F7D5]" note="Destaques, superfícies" />
            <Swatch name="Fundo" hex="#F8FAF9" className="bg-[#F8FAF9]" />
            <Swatch name="Texto" hex="#192A30" className="bg-[#192A30]" />
            <Swatch name="Texto 2" hex="#64747D" className="bg-[#64747D]" note="Ajustado p/ AA" />
            <Swatch name="Borda" hex="#E3E9E6" className="bg-[#E3E9E6]" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "A receber", fg: "text-positive", bg: "bg-positive-soft", value: 10000 },
              { label: "Você deve", fg: "text-negative", bg: "bg-negative-soft", value: -2000 },
              { label: "Pendente", fg: "text-warning", bg: "bg-warning-soft", value: 4500 },
            ].map((c) => (
              <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
                <p className={`${c.fg} text-sm font-semibold`}>{c.label}</p>
                <Money amountMinor={Math.abs(c.value)} className={`${c.fg} font-display text-2xl font-bold`} />
              </div>
            ))}
          </div>
        </Section>

        {/* ───────────── Tipografia ───────────── */}
        <Section id="tipografia" title="Tipografia" description="Plus Jakarta Sans para títulos e valores de destaque; Inter para interface. Números sempre tabulares.">
          <div className="bg-card space-y-5 rounded-3xl border p-6">
            <div>
              <p className="text-muted-foreground text-xs">Display · Jakarta 800 · 48</p>
              <p className="font-display text-5xl font-extrabold tracking-tight">Dividir ficou simples.</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Título · Jakarta 700 · 24</p>
              <p className="font-display text-2xl font-bold tracking-tight">Viagem para a praia</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Corpo · Inter 400 · 15</p>
              <p className="text-[15px]">Registre o que alguém pagou, escolha quem participou e o Meluno resolve as contas.</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor · Jakarta 800 tabular</p>
              <Money amountMinor={123456789} className="font-display text-4xl font-extrabold tracking-tight" />
            </div>
          </div>
        </Section>

        {/* ───────────── Botões ───────────── */}
        <Section id="botoes" title="Botões" description="Altura mínima de 44px para toque. Leve compressão ao pressionar.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <Plus /> Nova despesa
            </Button>
            <Button variant="mint">
              <ArrowLeftRight /> Acertar contas
            </Button>
            <Button variant="outline">
              <UserPlus /> Convidar
            </Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">
              <Trash2 /> Excluir
            </Button>
            <Button disabled>Desabilitado</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="lg">Criar conta grátis</Button>
            <Button size="sm" variant="outline">
              Pequeno
            </Button>
            <Button size="icon" aria-label="Adicionar">
              <Plus />
            </Button>
            <Button size="icon-lg" variant="mint" aria-label="Adicionar">
              <Plus />
            </Button>
          </div>
        </Section>

        {/* ───────────── Campos ───────────── */}
        <Section id="campos" title="Campos" description="O valor é digitado como em app de banco: os dígitos preenchem a partir dos centavos. Nenhum ponto flutuante envolvido.">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-card rounded-3xl border p-6">
              <Label htmlFor="hero-amount" className="text-muted-foreground block text-center text-xs font-medium tracking-wide uppercase">
                Quanto foi?
              </Label>
              <MoneyInput id="hero-amount" size="hero" value={amount} onValueChange={setAmount} className="mt-2" />
              <p className="text-muted-foreground mt-2 text-center text-xs">
                Valor salvo: <span className="tabular font-mono">{amount}</span> centavos
              </p>
              <div className="mt-6">
                <SplitMethodPicker value={method} onChange={setMethod} />
                <p className="text-muted-foreground mt-3 text-center text-sm">
                  {method === "EQUAL" && (
                    <>
                      3 pessoas · <Money amountMinor={Math.floor(amount / 3)} /> cada
                      {amount % 3 !== 0 ? ` (+1 centavo para ${amount % 3})` : ""}
                    </>
                  )}
                  {method === "EXACT" && "Informe quanto coube a cada pessoa"}
                  {method === "PERCENT" && "Porcentagens precisam somar 100%"}
                  {method === "SHARES" && "Ex.: 2 partes para quem consumiu mais"}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Input id="desc" placeholder="Ex.: Supermercado" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Valor</Label>
                <MoneyInput id="price" value={4590} onValueChange={() => {}} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-err">E-mail</Label>
                <Input id="email-err" defaultValue="maria@" aria-invalid aria-describedby="email-err-msg" />
                <p id="email-err-msg" className="text-destructive text-sm">
                  Esse e-mail parece incompleto. Confira o que vem depois do @.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <p className="text-sm font-medium">Simplificar dívidas</p>
                  <p className="text-muted-foreground text-xs">Menos transferências para acertar</p>
                </div>
                <Switch defaultChecked aria-label="Simplificar dívidas" />
              </div>
            </div>
          </div>
        </Section>

        {/* ───────────── Saldos ───────────── */}
        <Section id="saldos" title="Saldos" description="Mudanças de saldo animam suavemente (desligado com movimento reduzido).">
          <div className="relative overflow-hidden rounded-3xl bg-[#172D40] p-6 text-white dark:ring-1 dark:ring-white/10">
            <div className="bg-mint/20 absolute -top-16 -right-16 size-48 rounded-full blur-2xl" />
            <p className="text-sm text-white/70">Saldo geral</p>
            <AnimatedMoney
              amountMinor={balance}
              absolute
              className="font-display mt-1 block text-4xl font-extrabold tracking-tight text-white"
            />
            <p className="mt-1 text-sm text-white/70">
              {balance > 0 ? "no total, você tem a receber" : balance < 0 ? "no total, você deve" : "tudo acertado"}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/8 p-3">
                <p className="text-xs text-white/70">A receber</p>
                <AnimatedMoney amountMinor={Math.max(balance, 0) + 2000} className="text-mint font-semibold" />
              </div>
              <div className="rounded-2xl bg-white/8 p-3">
                <p className="text-xs text-white/70">Você deve</p>
                <AnimatedMoney amountMinor={Math.max(-balance, 0) + 2000} className="font-semibold text-[#ffb8a6]" />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setBalance(10000)}>
              +R$ 100
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBalance(-4550)}>
              −R$ 45,50
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBalance(0)}>
              Zerar
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-8">
            <BalanceLabel amountMinor={10000} />
            <BalanceLabel amountMinor={-2000} />
            <BalanceLabel amountMinor={0} />
            <Badge variant="positive">Confirmado</Badge>
            <Badge variant="warning">Aguardando confirmação</Badge>
            <Badge variant="negative">Recusado</Badge>
          </div>
        </Section>

        {/* ───────────── Pessoas ───────────── */}
        <Section id="pessoas" title="Pessoas" description="Avatares com iniciais e cor estável por pessoa. Contorno tracejado = participante ainda sem conta.">
          <div className="flex flex-wrap items-center gap-4">
            <MemberAvatar name="João Pedro" colorKey="m1" size="xl" />
            <MemberAvatar name="Maria Clara" colorKey="m2" size="lg" />
            <MemberAvatar name="Pedro Henrique" colorKey="m3" />
            <MemberAvatar name="Ana Luiza" colorKey="m4" size="sm" />
            <MemberAvatar name="Tio Carlos" colorKey="m9" size="lg" provisional />
            <MemberAvatarStack members={people} />
          </div>
        </Section>

        {/* ───────────── Listas ───────────── */}
        <Section id="listas" title="Listas" description="Cartões de grupo, despesas e atividade.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <GroupCard name="Viagem para Ubatuba" category="TRIP" memberCount={5} balanceMinor={18750} lastActivityAt={daysAgo(0)} now={NOW} />
              <GroupCard name="Apê da Rua Augusta" category="HOME" memberCount={3} balanceMinor={-4320} lastActivityAt={daysAgo(1)} now={NOW} />
              <GroupCard name="Churrasco de sábado" category="EVENT" memberCount={8} balanceMinor={0} lastActivityAt={daysAgo(12)} now={NOW} />
              <GroupCard name="Nós dois" category="COUPLE" memberCount={2} balanceMinor={0} lastActivityAt={null} now={NOW} />
            </div>
            <div className="bg-card divide-y rounded-2xl border px-4">
              <ExpenseRow description="Supermercado" category="GROCERIES" totalMinor={24000} paidByLabel="Você pagou" userImpactMinor={16000} dateLabel="hoje" />
              <ExpenseRow description="Uber para a rodoviária" category="TRANSPORT" totalMinor={4590} paidByLabel="Maria pagou" userImpactMinor={-1530} dateLabel="ontem" />
              <ExpenseRow description="Ingressos do show" category="EVENTS" totalMinor={36000} paidByLabel="Pedro pagou" userImpactMinor={0} dateLabel="8 de nov." />
              <ExpenseRow description="Conta de luz" category="UTILITIES" totalMinor={18733} paidByLabel="2 pessoas pagaram" userImpactMinor={-6244} dateLabel="3 de nov." />
            </div>
          </div>
          <div className="bg-card mt-6 divide-y rounded-2xl border px-4">
            <ActivityItem actorName="João Pedro" actorId="m1" kind="expense_created" context="Viagem para Ubatuba" timeLabel="há 5 min">
              adicionou <strong className="font-semibold">Supermercado</strong> · <Money amountMinor={24000} />
            </ActivityItem>
            <ActivityItem actorName="Maria Clara" actorId="m2" kind="expense_updated" context="Apê da Rua Augusta" timeLabel="há 2 h">
              alterou o valor de <strong className="font-semibold">Internet</strong>
            </ActivityItem>
            <ActivityItem actorName="Pedro Henrique" actorId="m3" kind="settlement" context="Viagem para Ubatuba" timeLabel="ontem">
              registrou um pagamento de <Money amountMinor={8000} className="font-semibold" /> para João
            </ActivityItem>
            <ActivityItem actorName="Ana Luiza" actorId="m4" kind="member_joined" context="Churrasco de sábado" timeLabel="8 de nov.">
              entrou no grupo
            </ActivityItem>
          </div>
        </Section>

        {/* ───────────── Estados ───────────── */}
        <Section id="estados" title="Estados" description="Estados vazios orientam a próxima ação; skeletons seguem a forma real do conteúdo.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-card rounded-3xl border">
              <EmptyState
                icon={Users}
                title="Seu primeiro grupo"
                description="Crie um grupo para a viagem, a casa ou o churrasco e convide quem divide com você."
                action={
                  <Button>
                    <Plus /> Criar grupo
                  </Button>
                }
              />
            </div>
            <div className="bg-card rounded-3xl border">
              <EmptyState
                icon={ReceiptText}
                title="Nenhuma despesa ainda"
                description="Registre o que alguém pagou e o Meluno faz as contas."
                action={<Button variant="mint">Adicionar despesa</Button>}
              />
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Carregamento</p>
              <Button size="sm" variant="outline" onClick={() => setLoading((v) => !v)}>
                {loading ? "Mostrar conteúdo" : "Mostrar skeleton"}
              </Button>
            </div>
            {loading ? (
              [0, 1].map((i) => (
                <div key={i} className="bg-card flex items-center gap-3.5 rounded-2xl border p-3.5">
                  <Skeleton className="size-12 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))
            ) : (
              <>
                <GroupCard name="Viagem para Ubatuba" category="TRIP" memberCount={5} balanceMinor={18750} lastActivityAt={daysAgo(0)} now={NOW} className="animate-in fade-in-0" />
                <GroupCard name="Apê da Rua Augusta" category="HOME" memberCount={3} balanceMinor={-4320} lastActivityAt={daysAgo(1)} now={NOW} className="animate-in fade-in-0" />
              </>
            )}
          </div>
        </Section>

        {/* ───────────── Feedback ───────────── */}
        <Section id="feedback" title="Feedback" description="Confirmação imediata ao salvar, diálogo para ações destrutivas e bottom sheet para fluxos rápidos no mobile.">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setItems((v) => [`Despesa ${v.length + 1}`, ...v].slice(0, 4));
                toast.success("Despesa adicionada", { description: "Supermercado · R$ 240,00 dividido entre 3" });
              }}
            >
              Simular “despesa salva”
            </Button>
            <Button variant="outline" onClick={() => toast.error("Não foi possível salvar", { description: "Verifique sua conexão e tente de novo." })}>
              Toast de erro
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Confirmar exclusão</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir “Supermercado”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os saldos do grupo serão recalculados. A despesa continua no histórico e pode ser restaurada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => toast("Despesa excluída", { action: { label: "Desfazer", onClick: () => {} } })}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={() => setSheetOpen(true)}>
              Abrir bottom sheet
            </Button>
          </div>
          <ul className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <motion.li
                  key={it}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-card rounded-xl border px-4 py-3 text-sm"
                >
                  {it} adicionada à lista
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-3xl pb-8">
              <div className="bg-muted mx-auto mt-2 h-1.5 w-10 rounded-full" />
              <SheetHeader>
                <SheetTitle className="font-display text-lg">Nova despesa</SheetTitle>
                <SheetDescription>Fluxo rápido: valor, descrição, salvar.</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <MoneyInput size="hero" value={amount} onValueChange={setAmount} aria-label="Valor" />
                <Input placeholder="O que foi?" aria-label="Descrição" />
                <Button size="lg" className="w-full" onClick={() => setSheetOpen(false)}>
                  Salvar despesa
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </Section>

        {/* ───────────── Navegação ───────────── */}
        <Section id="navegacao" title="Navegação" description="Mobile: 4 destinos + ação central de nova despesa, ao alcance do polegar. Desktop: barra lateral (Etapa 4).">
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2.25rem] border-8 border-[#0d1a24] bg-background shadow-xl">
            <div className="h-72 space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Logo size="sm" />
                <MemberAvatar name="João Pedro" colorKey="m1" size="sm" />
              </div>
              <GroupCard name="Viagem para Ubatuba" category="TRIP" memberCount={5} balanceMinor={18750} lastActivityAt={daysAgo(0)} now={NOW} />
              <GroupCard name="Apê da Rua Augusta" category="HOME" memberCount={3} balanceMinor={-4320} lastActivityAt={daysAgo(1)} now={NOW} />
            </div>
            <BottomNav
              items={navItems}
              activeHref={activeNav}
              onAdd={() => setSheetOpen(true)}
              renderLink={(item, children, className) => (
                <button type="button" className={className} onClick={() => setActiveNav(item.href)} aria-current={activeNav === item.href ? "page" : undefined}>
                  {children}
                </button>
              )}
            />
          </div>
        </Section>
      </main>
    </div>
  );
}
