"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, KeyRound } from "lucide-react";
import { FormAlert, GoogleIcon } from "@/components/auth/auth-ui";
import { GoogleButton } from "@/components/auth/google-button";
import { oauthErrorMessage } from "@/lib/oauth-errors";

type Props = {
  hasPassword: boolean;
  hasGoogle: boolean;
  googleEnabled: boolean;
};

/** Formas de entrar na conta: senha e Google (conectar pelo Perfil). */
export function SignInMethods({ hasPassword, hasGoogle, googleEnabled }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  // Volta do Google: o resultado fica na seção (o estado sobrevive à limpeza da URL).
  const [notice] = useState(() => {
    const error = oauthErrorMessage(params.get("error"));
    if (error) return { tone: "error" as const, text: error };
    if (params.get("google") === "conectado")
      return {
        tone: "success" as const,
        text: "Conta Google conectada. Da próxima vez, é só entrar com o Google.",
      };
    return null;
  });

  useEffect(() => {
    if (params.has("error") || params.has("google")) router.replace("/perfil", { scroll: false });
  }, [params, router]);

  return (
    <div className="space-y-3">
      {notice ? <FormAlert tone={notice.tone}>{notice.text}</FormAlert> : null}
      <ul className="bg-card divide-y rounded-2xl border shadow-card">
        <li className="flex items-center gap-3 px-4 py-3.5">
          <KeyRound className="text-muted-foreground size-5" aria-hidden="true" />
          <span className="flex-1 text-sm font-medium">E-mail e senha</span>
          {hasPassword ? (
            <Link href="/recuperar-senha" className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline">
              Alterar senha
            </Link>
          ) : (
            <Link href="/recuperar-senha" className="text-sm font-semibold underline-offset-4 hover:underline">
              Criar senha
            </Link>
          )}
        </li>
        {googleEnabled || hasGoogle ? (
          <li className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <GoogleIcon />
              <span className="flex-1 text-sm font-medium">Google</span>
              {hasGoogle ? (
                <span className="text-positive inline-flex items-center gap-1 text-sm font-semibold">
                  <Check className="size-4" aria-hidden="true" /> Conectado
                </span>
              ) : null}
            </div>
            {!hasGoogle ? (
              <div className="mt-3">
                <GoogleButton label="Conectar Google" mode="link" variant="secondary" callbackURL="/perfil?google=conectado" errorCallbackURL="/perfil" />
                <p className="text-muted-foreground mt-2 text-xs">
                  Depois, é só tocar em &ldquo;Entrar com Google&rdquo;, sem digitar senha. Use o mesmo e-mail do cadastro.
                </p>
              </div>
            ) : null}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
