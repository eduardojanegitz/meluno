"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-redirect";
import { oauthErrorMessage } from "@/lib/oauth-errors";
import { signInSchema } from "@/schemas/auth";
import { AuthHeading, Divider, Field, FormAlert } from "./auth-ui";
import { GoogleButton } from "./google-button";

type Values = z.input<typeof signInSchema>;
type Parsed = z.output<typeof signInSchema>;

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  // Erro devolvido pelo Google (?error=) aparece até a próxima tentativa.
  const [serverError, setServerError] = useState<string | null>(() => oauthErrorMessage(params.get("error")));
  const here = next === "/inicio" ? "/entrar" : `/entrar?next=${encodeURIComponent(next)}`;
  const form = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await authClient.signIn.email({ ...values, callbackURL: next });
    if (error) {
      setServerError(authErrorMessage(error));
      if (error.code !== "EMAIL_NOT_VERIFIED") form.resetField("password");
      return;
    }
    router.replace(next);
    router.refresh();
  });

  return (
    <>
      <AuthHeading title="Que bom te ver" description="Entre para ver seus grupos e saldos." />
      {googleEnabled ? (
        <>
          {serverError ? <FormAlert>{serverError}</FormAlert> : null}
          <GoogleButton label="Entrar com Google" callbackURL={next} errorCallbackURL={here} />
          <Divider>ou com e-mail</Divider>
        </>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && !googleEnabled ? <FormAlert>{serverError}</FormAlert> : null}
        <Field label="E-mail" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...form.register("email")} />
        <div>
          <Field label="Senha" type="password" autoComplete="current-password" error={errors.password?.message} {...form.register("password")} />
          <div className="mt-2 text-right">
            <Link href="/recuperar-senha" className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline">
              Esqueci minha senha
            </Link>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Entrar
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Novo por aqui?{" "}
        <Link href={next === "/inicio" ? "/criar-conta" : `/criar-conta?next=${encodeURIComponent(next)}`} className="text-foreground font-semibold underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </>
  );
}
