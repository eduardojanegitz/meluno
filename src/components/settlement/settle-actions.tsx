"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { encode } from "uqr";
import { BellRing, Check, ChevronDown, Copy, Loader2, Mail, MessageCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Money } from "@/components/money/money";
import { celebrate } from "@/components/celebrate/celebration";
import { useAction } from "@/hooks/use-action";
import { buildPixPayload } from "@/lib/pix";
import { formatMoney, todayCivil } from "@/lib/format";
import { createSettlementAction, getPixKeysAction, sendReminderAction } from "@/server/actions/finance";

type Props = {
  groupId: string;
  groupName: string;
  currency: string;
  viewerMemberId: string;
  from: { id: string; name: string; hasAccount: boolean };
  to: { id: string; name: string; hasAccount: boolean };
  amountMinor: number;
};

type PixKey = { id: string; type: string; value: string; label: string | null; city: string | null };

/**
 * Ações de uma sugestão de acerto, conforme o papel de quem vê:
 *  - deve: "Pagar com Pix" (Copia e Cola + QR) e "Já paguei";
 *  - recebe: "Cobrar" (e-mail pelo Meluno ou WhatsApp pela própria pessoa);
 *  - terceiro: registrar.
 */
export function SettleActions({ groupId, groupName, currency, viewerMemberId, from, to, amountMinor }: Props) {
  const registerHref = `/grupos/${groupId}/acertar?de=${from.id}&para=${to.id}&valor=${amountMinor}`;
  const iOwe = from.id === viewerMemberId;
  const owedToMe = to.id === viewerMemberId;

  if (iOwe) {
    return (
      <div className="flex flex-wrap gap-2">
        {currency === "BRL" ? <PixPayButton {...{ groupId, groupName, viewerMemberId, to, amountMinor }} /> : null}
        <Button asChild size="sm" variant={currency === "BRL" ? "outline" : "mint"}>
          <Link href={registerHref}>{currency === "BRL" ? "Paguei de outro jeito" : "Registrar pagamento"}</Link>
        </Button>
      </div>
    );
  }
  if (owedToMe) {
    return (
      <div className="flex flex-wrap gap-2">
        <ChargeMenu {...{ groupId, groupName, currency, from, amountMinor }} />
        <Button asChild size="sm" variant="outline">
          <Link href={registerHref}>Recebi</Link>
        </Button>
      </div>
    );
  }
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={registerHref}>Registrar</Link>
    </Button>
  );
}

function PixPayButton({ groupId, groupName, viewerMemberId, to, amountMinor }: Pick<Props, "groupId" | "groupName" | "viewerMemberId" | "to" | "amountMinor">) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<PixKey[] | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const { run: loadKeys } = useAction(getPixKeysAction);
  const paid = useAction(createSettlementAction);

  useEffect(() => {
    if (!open || keys !== null) return;
    void loadKeys({ groupId, memberId: to.id }, { silentError: true, onSuccess: (k) => setKeys(k as PixKey[]) }).then((r) => {
      if (!r.ok) setKeys([]);
    });
  }, [open, keys, loadKeys, groupId, to.id]);

  const key = keys?.[0];
  const payload = useMemo(
    () => (key ? buildPixPayload({ key: key.value, name: to.name, city: key.city ?? undefined, amountMinor, description: `Meluno ${groupName}` }) : null),
    [key, to.name, amountMinor, groupName],
  );

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setIdempotencyKey(crypto.randomUUID().replace(/-/g, ""));
          setOpen(true);
        }}
      >
        <QrCode /> Pagar com Pix
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pagar <Money amountMinor={amountMinor} currency="BRL" /> para {to.name}
            </DialogTitle>
            <DialogDescription>Copie o código e cole no app do seu banco, ou leia o QR Code. Depois volte aqui e toque em “Já paguei”.</DialogDescription>
          </DialogHeader>

          {keys === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Carregando chave Pix" />
            </div>
          ) : !payload ? (
            <p className="bg-warning-soft text-warning rounded-2xl px-4 py-3 text-sm">
              {to.hasAccount ? `${to.name} ainda não cadastrou uma chave Pix no Meluno.` : `${to.name} ainda não tem conta no Meluno, então não há chave Pix.`} Combine o pagamento por fora e
              registre em “Paguei de outro jeito”.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-fit rounded-2xl border-2 bg-white p-3">
                <QrSvg value={payload} size={200} label={`QR Code Pix de ${formatMoney(amountMinor, { currency: "BRL" })} para ${to.name}`} />
              </div>
              <div className="bg-muted rounded-2xl p-3">
                <p className="text-muted-foreground text-xs font-semibold">Pix Copia e Cola</p>
                <p className="mt-1 line-clamp-2 font-mono text-xs break-all">{payload}</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(payload);
                    toast.success("Código copiado. Agora é colar no app do banco.");
                  } catch {
                    toast.error("Não deu pra copiar. Selecione o código e copie manualmente.");
                  }
                }}
              >
                <Copy /> Copiar código
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                Chave de {to.name}: <span className="font-mono">{key!.value}</span>
              </p>
            </div>
          )}

          <Button
            className="w-full"
            disabled={paid.pending || keys === null}
            onClick={() =>
              paid.run(
                { groupId, fromMemberId: viewerMemberId, toMemberId: to.id, amountMinor, date: todayCivil(), method: "PIX", idempotencyKey },
                {
                  onSuccess: () => {
                    setOpen(false);
                    celebrate({ title: "Boa!", subtitle: `Avisamos ${to.name}. Quando confirmar, a conta fecha.`, mood: "happy" });
                    router.refresh();
                  },
                },
              )
            }
          >
            {paid.pending ? <Loader2 className="animate-spin" /> : <Check />} Já paguei
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChargeMenu({ groupId, groupName, currency, from, amountMinor }: Pick<Props, "groupId" | "groupName" | "currency" | "from" | "amountMinor">) {
  const remind = useAction(sendReminderAction);
  const amountLabel = formatMoney(amountMinor, { currency });

  const whatsapp = async () => {
    // Abre a janela já no clique (bloqueadores de pop-up exigem gesto do usuário)
    // e só depois aponta para o WhatsApp, quando o servidor libera o lembrete.
    const win = window.open("about:blank", "_blank");
    if (win) win.opener = null;
    const r = await remind.run({ groupId, debtorMemberId: from.id, channel: "WHATSAPP" });
    if (!r.ok) {
      win?.close();
      return;
    }
    const pix = r.data.pixCode ? `\n\nMeu Pix Copia e Cola (é só colar no app do banco):\n${r.data.pixCode}` : "";
    const text = `Oi, ${from.name}! Passando pra lembrar do acerto de ${amountLabel} do grupo "${groupName}" no Meluno. Quando puder, me manda um Pix 💚${pix}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (win) win.location.href = url;
    else window.location.href = url;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={remind.pending}>
          {remind.pending ? <Loader2 className="animate-spin" /> : <BellRing />} Cobrar <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {from.hasAccount ? (
          <DropdownMenuItem
            onSelect={() =>
              void remind.run(
                { groupId, debtorMemberId: from.id, channel: "EMAIL" },
                { onSuccess: () => celebrate({ title: "Lembrete enviado", subtitle: `${from.name} recebeu um e-mail gentil.`, mood: "happy" }) },
              )
            }
          >
            <Mail /> Lembrar por e-mail
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => void whatsapp()}>
          <MessageCircle /> Mandar no WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** QR Code desenhado como um único <path> a partir da matriz (sem innerHTML). */
function QrSvg({ value, size, label }: { value: string; size: number; label: string }) {
  const { d, n } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let path = "";
    qr.data.forEach((row, y) => row.forEach((on, x) => (on ? (path += `M${x} ${y}h1v1h-1z`) : null)));
    return { d: path, n: qr.size };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#172D40" />
    </svg>
  );
}
