"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado da instalação do PWA, compartilhado por todos os botões "Instalar".
 *
 * - "prompt":   Chrome/Edge/Samsung guardaram o convite nativo; um toque abre o diálogo.
 * - "ios":      iPhone/iPad não têm convite; mostramos o passo a passo do Compartilhar.
 * - "installed": já roda como app (tela inicial) ou acabou de ser instalado.
 * - "unsupported": navegador sem instalação por um toque (Firefox, desktop Safari…).
 * - "unknown":  no servidor e na primeira renderização (evita divergência na hidratação).
 */
export type InstallStatus = "unknown" | "prompt" | "ios" | "installed" | "unsupported";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let status: InstallStatus = "unknown";
const listeners = new Set<() => void>();

function set(next: InstallStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ se apresenta como Mac; o toque denuncia.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Navegadores embutidos (Instagram, Facebook…) não instalam: é preciso abrir no Safari/Chrome. */
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line\/|LinkedInApp|TikTok/i.test(navigator.userAgent);
}

function detect(): InstallStatus {
  if (isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  return "unsupported";
}

// O Chrome dispara o convite logo no carregamento, antes de qualquer botão existir:
// o ouvinte é registrado ao importar o módulo (ele é importado pelos Providers).
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // guarda para o nosso botão em vez da mini-barra do navegador
    deferred = e as BeforeInstallPromptEvent;
    set("prompt");
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    set("installed");
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (status === "unknown") queueMicrotask(() => set(detect()));
  return () => listeners.delete(l);
}

export function useInstallStatus(): InstallStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => "unknown",
  );
}

/** Abre o diálogo nativo. Retorna o resultado; "unavailable" se o convite já foi usado. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  // O convite só pode ser usado uma vez.
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  set(outcome === "accepted" ? "installed" : detect());
  return outcome;
}

