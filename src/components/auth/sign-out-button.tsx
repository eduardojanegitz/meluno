"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { unsubscribePushAction } from "@/server/actions/profile";

/** Aparelho compartilhado: quem sai não deve continuar recebendo push da conta. */
async function dropPushSubscription() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await unsubscribePushAction({ endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch {
    /* sem suporte ou já removida */
  }
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await dropPushSubscription();
        await authClient.signOut();
        router.replace("/entrar");
        router.refresh();
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
      Sair
    </Button>
  );
}
