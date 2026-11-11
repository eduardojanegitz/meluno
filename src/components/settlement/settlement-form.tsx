"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Check, Copy, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { todayCivil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/money/money-input";
import { MemberAvatar } from "@/components/member-avatar";
import { useAction } from "@/hooks/use-action";
import { createSettlementAction, getPixKeysAction } from "@/server/actions/finance";
import type { FormMember } from "@/components/expense/expense-form";

type Props = {
  group: { id: string; name: string; currency: string };
  members: FormMember[];
  viewerMemberId: string;
  initial: { from: string; to: string; amountMinor: number };
};

const methods = [
  { value: "PIX", label: "Pix" },
  { value: "CASH", label: "Dinheiro" },
  { value: "TRANSFER", label: "Transferência" },
  { value: "OTHER", label: "Outro" },
] as const;

const pixLabel = { CPF: "CPF", CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Celular", RANDOM: "Chave aleatória" } as const;

type PixKey = { id: string; type: keyof typeof pixLabel; value: string; label: string | null };

function MemberSelect({ id, label, value, onChange, members, viewerMemberId, exclude }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  members: FormMember[];
  viewerMemberId: string;
  exclude?: string;
}) {
  const selected = members.find((m) => m.id === value);
  return (
    <div className="bg-card flex items-center gap-3 rounded-2xl border px-4 py-3">
      {selected ? <MemberAvatar name={selected.name} colorKey={selected.id} imageUrl={selected.imageUrl} /> : null}
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
          {label}
        </Label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-base font-semibold outline-none">
          {members
            .filter((m) => m.id !== exclude)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === viewerMemberId ? `Você (${m.name})` : m.name}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}

/** Remontado após salvar (o Next preserva o estado de páginas visitadas). */
export function SettlementForm(props: Props) {
  const [generation, setGeneration] = useState(0);
  const { from, to, amountMinor } = props.initial;
  return <SettlementFormInner key={`${generation}-${from}-${to}-${amountMinor}`} {...props} onSaved={() => setGeneration((g) => g + 1)} />;
}

function SettlementFormInner({ group, members, viewerMemberId, initial, onSaved }: Props & { onSaved: () => void }) {
  const router = useRouter();
  const create = useAction(createSettlementAction);
  const pix = useAction(getPixKeysAction);
  const [idempotencyKey] = useState(() => crypto.randomUUID().replace(/-/g, ""));
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [amount, setAmount] = useState(initial.amountMinor);
  const [date, setDate] = useState(todayCivil());
  const [method, setMethod] = useState<(typeof methods)[number]["value"]>("PIX");
  const [note, setNote] = useState("");
  // Chaves carregadas por destinatário; só valem enquanto ele continua selecionado.
  const [loaded, setLoaded] = useState<{ memberId: string; keys: PixKey[] } | null>(null);
  const keys = loaded?.memberId === to ? loaded.keys : null;
  const [copied, setCopied] = useState<string | null>(null);

  const receiver = members.find((m) => m.id === to);
  const name = (id: string) => (id === viewerMemberId ? "você" : (members.find((m) => m.id === id)?.name ?? ""));
  const runPix = pix.run;

  useEffect(() => {
    if (!to || to === viewerMemberId) return;
    void runPix({ groupId: group.id, memberId: to }, { silentError: true, onSuccess: (k) => setLoaded({ memberId: to, keys: k as PixKey[] }) });
  }, [to, group.id, viewerMemberId, runPix]);

  async function copy(k: PixKey) {
    try {
      await navigator.clipboard.writeText(k.value);
      setCopied(k.id);
      toast.success("Chave Pix copiada");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione a chave manualmente.");
    }
  }

  const willConfirm = to === viewerMemberId;

  return (
    <form
      noValidate
      className="space-y-6 pb-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount <= 0 || from === to) return;
        void create.run(
          { groupId: group.id, fromMemberId: from, toMemberId: to, amountMinor: amount, date, method, note: note.trim() || undefined, idempotencyKey },
          {
            successMessage: willConfirm ? "Pagamento registrado" : "Pagamento registrado — aguardando confirmação",
            onSuccess: () => {
              router.push(`/grupos/${group.id}?aba=saldos`);
              router.refresh();
              onSaved();
            },
          },
        );
      }}
    >
      <div className="space-y-2">
        <MemberSelect id="from" label="Quem pagou" value={from} onChange={setFrom} members={members} viewerMemberId={viewerMemberId} exclude={to} />
        <div className="flex justify-center">
          <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full">
            <ArrowDown className="size-4" aria-hidden="true" />
          </span>
        </div>
        <MemberSelect id="to" label="Quem recebeu" value={to} onChange={setTo} members={members} viewerMemberId={viewerMemberId} exclude={from} />
      </div>

      <div className="text-center">
        <Label htmlFor="settle-amount" className="text-muted-foreground block text-xs font-medium tracking-wide uppercase">
          Valor
        </Label>
        <MoneyInput id="settle-amount" size="hero" value={amount} onValueChange={setAmount} currency={group.currency} />
        {initial.amountMinor > 0 && amount !== initial.amountMinor ? (
          <p className="text-muted-foreground mt-1 text-xs">Pagamento parcial também vale: o restante continua em aberto.</p>
        ) : null}
      </div>

      {method === "PIX" && receiver && to !== viewerMemberId ? (
        <section className="bg-card rounded-2xl border p-4" aria-labelledby="pix-title">
          <h2 id="pix-title" className="text-sm font-semibold">
            Chave Pix de {receiver.name}
          </h2>
          {pix.pending && keys === null ? (
            <p className="text-muted-foreground mt-2 text-sm">Carregando…</p>
          ) : keys && keys.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {keys.map((k) => (
                <li key={k.id} className="bg-muted/60 flex items-center gap-3 rounded-xl px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">{k.label ?? pixLabel[k.type]}</p>
                    <p className="truncate font-mono text-sm">{k.value}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => copy(k)}>
                    {copied === k.id ? <Check /> : <Copy />} {copied === k.id ? "Copiada" : "Copiar"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              {receiver.provisional ? `${receiver.name} ainda não tem conta no Meluno.` : `${receiver.name} ainda não cadastrou uma chave Pix.`}
            </p>
          )}
          <p className="text-muted-foreground mt-3 flex gap-1.5 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            O Meluno não movimenta dinheiro. Faça o Pix pelo app do seu banco e registre aqui.
          </p>
        </section>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Forma de pagamento</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {methods.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={method === m.value}
              onClick={() => setMethod(m.value)}
              className={cn(
                "focus-visible:ring-ring h-9 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2",
                method === m.value ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settle-date">Data</Label>
          <Input id="settle-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settle-note">Observação (opcional)</Label>
          <Input id="settle-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="Ex.: parte do aluguel" />
        </div>
      </div>

      <p className={cn("rounded-2xl px-4 py-3 text-sm", willConfirm ? "bg-positive-soft text-positive" : "bg-muted text-muted-foreground")}>
        {willConfirm
          ? "Como você é quem recebeu, o pagamento entra nos saldos na hora."
          : receiver?.provisional
            ? `${receiver.name} não tem conta: um administrador do grupo confirma o recebimento.`
            : `O saldo muda quando ${name(to)} confirmar que recebeu.`}
      </p>

      <Button type="submit" size="lg" className="w-full" disabled={create.pending || amount <= 0 || from === to}>
        {create.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
        Registrar pagamento
      </Button>
    </form>
  );
}
