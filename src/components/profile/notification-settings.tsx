"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { isIos, isStandalone } from "@/lib/install";
import { subscribePushAction, testPushAction, unsubscribePushAction, updateNotificationPrefsAction } from "@/server/actions/profile";

type Prefs = { emailOnExpense: boolean; emailOnSettlement: boolean; emailWeeklySummary: boolean };
type PushState = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Navegador";
  const os = isIos() ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} no ${os}` : browser;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Notificações: push neste aparelho + avisos por e-mail. Cada interruptor salva na hora. */
export function NotificationSettings({ prefs, vapidPublicKey }: { prefs: Prefs; vapidPublicKey: string | null }) {
  return (
    <div className="bg-card divide-y rounded-2xl border shadow-card">
      {vapidPublicKey ? <PushRow vapidPublicKey={vapidPublicKey} /> : null}
      <EmailRows prefs={prefs} />
    </div>
  );
}

function PushRow({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const { run: subscribe } = useAction(subscribePushAction);
  const { run: unsubscribe } = useAction(unsubscribePushAction);
  const test = useAction(testPushAction);

  useEffect(() => {
    let alive = true;
    (async () => {
      let next: PushState;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // No iPhone, push só existe com o app instalado na tela inicial (iOS 16.4+).
        next = isIos() && !isStandalone() ? "ios-install" : "unsupported";
      } else if (Notification.permission === "denied") next = "denied";
      else next = (await currentSubscription().catch(() => null)) ? "on" : "off";
      if (alive) setState(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidPublicKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const result = await subscribe({ endpoint: json.endpoint, keys: json.keys, device: deviceLabel() });
      if (result.ok) {
        setState("on");
        toast.success("Notificações ativadas neste aparelho");
      } else {
        await sub.unsubscribe();
      }
    } catch {
      toast.error("Não foi possível ativar as notificações neste navegador.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await unsubscribe({ endpoint: sub.endpoint }, { silentError: true });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  const hint: Record<PushState, string> = {
    checking: "",
    unsupported: "Este navegador não recebe notificações.",
    "ios-install": "No iPhone, instale o Meluno na tela inicial para receber notificações.",
    denied: "As notificações estão bloqueadas. Libere nas configurações do navegador para este site.",
    off: "Avisos de despesas, pagamentos e lembretes, mesmo com o app fechado.",
    on: "Ativas neste aparelho.",
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <BellRing className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Label htmlFor="push-toggle" className="text-sm font-semibold">
            Notificações neste aparelho
          </Label>
          <p className="text-muted-foreground text-xs">{hint[state]}</p>
        </div>
        {state === "checking" || busy ? <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden="true" /> : null}
        <Switch
          id="push-toggle"
          checked={state === "on"}
          disabled={busy || (state !== "on" && state !== "off")}
          onCheckedChange={(v) => void (v ? enable() : disable())}
        />
      </div>
      {state === "on" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          disabled={test.pending}
          onClick={async () => {
            const sub = await currentSubscription();
            if (sub) void test.run({ endpoint: sub.endpoint }, { successMessage: "Notificação de teste enviada" });
          }}
        >
          Enviar uma notificação de teste
        </Button>
      ) : null}
    </div>
  );
}

const EMAIL_OPTIONS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "emailOnExpense", label: "Despesas em que estou", hint: "Quando alguém lança uma despesa que inclui você." },
  { key: "emailOnSettlement", label: "Pagamentos", hint: "Quando registram ou confirmam um pagamento seu." },
  { key: "emailWeeklySummary", label: "Resumo semanal", hint: "Uma vez por semana, quanto você deve e tem a receber em cada grupo." },
];

function EmailRows({ prefs }: { prefs: Prefs }) {
  const [values, setValues] = useState(prefs);
  const save = useAction(updateNotificationPrefsAction);

  return (
    <div className="space-y-4 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Mail className="text-muted-foreground size-5" aria-hidden="true" /> Por e-mail
      </p>
      {EMAIL_OPTIONS.map((o) => (
        <div key={o.key} className="flex items-center gap-3 pl-7">
          <div className="min-w-0 flex-1">
            <Label htmlFor={`pref-${o.key}`} className="text-sm">
              {o.label}
            </Label>
            <p className="text-muted-foreground text-xs">{o.hint}</p>
          </div>
          <Switch
            id={`pref-${o.key}`}
            checked={values[o.key]}
            onCheckedChange={async (v) => {
              setValues((p) => ({ ...p, [o.key]: v }));
              const result = await save.run({ [o.key]: v });
              if (!result.ok) setValues((p) => ({ ...p, [o.key]: !v }));
            }}
          />
        </div>
      ))}
    </div>
  );
}
