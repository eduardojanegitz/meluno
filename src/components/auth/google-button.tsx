"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { GoogleIcon } from "./auth-ui";

type Props = {
  label: string;
  /** Para onde ir depois de entrar. */
  callbackURL: string;
  /** Para onde voltar se o Google ou a vinculação falharem (recebe `?error=`). */
  errorCallbackURL: string;
  /** "link" conecta o Google à conta já logada (Perfil). */
  mode?: "sign-in" | "link";
  variant?: "outline" | "secondary";
};

export function GoogleButton({ label, callbackURL, errorCallbackURL, mode = "sign-in", variant = "outline" }: Props) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      className="w-full text-[15px]"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } =
          mode === "link"
            ? await authClient.linkSocial({ provider: "google", callbackURL, errorCallbackURL })
            : await authClient.signIn.social({ provider: "google", callbackURL, newUserCallbackURL: callbackURL, errorCallbackURL });
        if (error) {
          setPending(false);
          toast.error(authErrorMessage(error));
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <GoogleIcon />}
      {label}
    </Button>
  );
}
