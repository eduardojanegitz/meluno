"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Ellipsis, Share, SquarePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Melu } from "@/components/brand/melu";
import { celebrate } from "@/components/celebrate/celebration";
import { isInAppBrowser, promptInstall, useInstallStatus } from "@/lib/install";

/** Lógica comum: um toque instala (Android/desktop) ou abre o passo a passo (iPhone). */
function useInstall() {
  const status = useInstallStatus();
  const [guideOpen, setGuideOpen] = useState(false);
  const available = status === "prompt" || status === "ios";
  const install = async () => {
    if (status === "ios") return setGuideOpen(true);
    const outcome = await promptInstall();
    if (outcome === "accepted") celebrate({ title: "Meluno instalado!", subtitle: "Ele já está na sua tela inicial.", mood: "celebrate", big: true });
  };
  const guide = <IosGuide open={guideOpen} onOpenChange={setGuideOpen} />;
  return { status, available, install, guide };
}

type ButtonProps = { label?: string; className?: string; size?: "sm" | "default" | "lg"; variant?: "default" | "outline" | "mint" | "secondary" };

/** Botão "Instalar app"; some quando já está instalado ou o navegador não permite. */
export function InstallButton({ label = "Instalar app", className, size = "lg", variant = "outline" }: ButtonProps) {
  const { available, install, guide } = useInstall();
  if (!available) return null;
  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={install}>
        <Download aria-hidden="true" /> {label}
      </Button>
      {guide}
    </>
  );
}

const DISMISS_KEY = "meluno.install.dismissedAt";
const DISMISS_FOR = 30 * 24 * 60 * 60 * 1000;

function readDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_FOR;
  } catch {
    return false;
  }
}

// Fechar o cartão vale para todas as abas abertas desta sessão.
let dismissedNow = false;
const dismissListeners = new Set<() => void>();
function useDismissed(): [boolean, () => void] {
  const dismissed = useSyncExternalStore(
    (l) => {
      dismissListeners.add(l);
      return () => dismissListeners.delete(l);
    },
    () => dismissedNow || readDismissed(),
    () => true, // no servidor, não renderiza (evita piscar)
  );
  const dismiss = () => {
    dismissedNow = true;
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* armazenamento bloqueado: fecha só nesta visita */
    }
    dismissListeners.forEach((l) => l());
  };
  return [dismissed, dismiss];
}

/**
 * Cartão "Coloque o Meluno na tela inicial".
 * `dismissible` (Início): pode ser fechado e volta depois de 30 dias.
 */
export function InstallCard({ dismissible = false, className }: { dismissible?: boolean; className?: string }) {
  const { available, install, guide, status } = useInstall();
  const [dismissed, dismiss] = useDismissed();
  if (!available || (dismissible && dismissed)) return null;
  return (
    <div className={cn("bg-mint/40 dark:bg-mint/10 relative flex items-center gap-3 rounded-2xl border-2 p-4", className)}>
      <Melu mood="happy" size={56} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Coloque o Meluno na tela inicial</p>
        <p className="text-muted-foreground text-sm">Abre num toque, em tela cheia, como um app. Sem loja e sem download pesado.</p>
        <Button type="button" size="sm" className="mt-3" onClick={install}>
          {status === "ios" ? <Share aria-hidden="true" /> : <Download aria-hidden="true" />}
          {status === "ios" ? "Ver como instalar" : "Instalar agora"}
        </Button>
      </div>
      {dismissible ? (
        <Button type="button" variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label="Agora não" onClick={dismiss}>
          <X />
        </Button>
      ) : null}
      {guide}
    </div>
  );
}

/**
 * Aviso flutuante só no iPhone/iPad (o Safari não tem convite de instalação próprio).
 * Aparece nas páginas de fora do app; fechar vale por 30 dias, junto com o cartão do Início.
 */
export function IosInstallBanner() {
  const { status, install, guide } = useInstall();
  const [dismissed, dismiss] = useDismissed();
  if (status !== "ios" || dismissed) return null;
  return (
    <>
      <div
        role="region"
        aria-label="Instalar o Meluno"
        className="bg-card animate-in fade-in slide-in-from-bottom-4 fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border-2 p-3 shadow-lg duration-500"
      >
        <Melu mood="happy" size={40} className="shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          <strong>Instale o Meluno:</strong> toque em <Share className="inline size-4 align-[-3px]" aria-label="Compartilhar" /> e depois em{" "}
          <strong>Adicionar à Tela de Início</strong>.{" "}
          <button type="button" className="text-primary font-semibold underline underline-offset-2" onClick={install}>
            Ver como
          </button>
        </p>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Agora não" onClick={dismiss}>
          <X />
        </Button>
      </div>
      {guide}
    </>
  );
}

/** Passo a passo do iPhone/iPad (o Safari não tem botão de instalar programático). */
function IosGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const inApp = typeof navigator !== "undefined" && isInAppBrowser();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="text-xl font-extrabold">Instalar no iPhone</SheetTitle>
          <SheetDescription>Três toques e o Meluno fica na sua tela inicial.</SheetDescription>
        </SheetHeader>
        {inApp ? (
          <p className="bg-warning-soft text-foreground rounded-xl px-3.5 py-3 text-sm">
            Você está no navegador de outro app. Toque em <strong>•••</strong> e escolha <strong>Abrir no Safari</strong> primeiro.
          </p>
        ) : null}
        <ol className="space-y-3">
          <Step n={1} icon={<Share className="size-5" aria-hidden="true" />}>
            Toque em <strong>Compartilhar</strong> na barra do navegador.
            <span className="text-muted-foreground mt-0.5 block text-xs">
              Não achou? Toque em <Ellipsis className="inline size-3.5 align-[-3px]" aria-label="mais opções" /> e depois em Compartilhar.
            </span>
          </Step>
          <Step n={2} icon={<SquarePlus className="size-5" aria-hidden="true" />}>
            Role a lista e escolha <strong>Adicionar à Tela de Início</strong>.
          </Step>
          <Step n={3} icon={<span className="text-sm font-black text-[#0a84ff]">Adicionar</span>}>
            Confirme em <strong>Adicionar</strong>, no canto de cima.
          </Step>
        </ol>
        <Button type="button" size="lg" className="mt-2 w-full" onClick={() => onOpenChange(false)}>
          Entendi
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="bg-card flex items-center gap-3 rounded-2xl border-2 p-3">
      <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-full text-sm font-black" aria-hidden="true">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      <span className="bg-muted grid h-10 min-w-10 shrink-0 place-items-center rounded-xl px-2">{icon}</span>
    </li>
  );
}
