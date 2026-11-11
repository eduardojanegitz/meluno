"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { requestResetSchema, resetPasswordSchema } from "@/schemas/auth";
import { AuthHeading, Field, FormAlert } from "./auth-ui";

export function RequestResetForm() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.input<typeof requestResetSchema>, unknown, z.output<typeof requestResetSchema>>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setServerError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/redefinir-senha" });
    // A resposta é a mesma exista ou não a conta (não revela e-mails cadastrados).
    if (error && error.status === 429) {
      setServerError(authErrorMessage(error));
      return;
    }
    setDone(true);
  });

  return (
    <>
      <AuthHeading title="Recuperar senha" description="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha." />
      {done ? (
        <FormAlert tone="success">
          Se houver uma conta com esse e-mail, você receberá o link em instantes. Ele expira em 1 hora.
        </FormAlert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {serverError ? <FormAlert>{serverError}</FormAlert> : null}
          <Field label="E-mail" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...form.register("email")} />
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Enviar link
          </Button>
        </form>
      )}
      <Link href="/entrar" className="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" aria-hidden="true" /> Voltar para o login
      </Link>
    </>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.input<typeof resetPasswordSchema>, unknown, z.output<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;

  if (!token || linkError) {
    return (
      <>
        <AuthHeading title="Link inválido" description="Este link de redefinição expirou ou já foi usado." />
        <Button asChild size="lg" className="w-full">
          <Link href="/recuperar-senha">Pedir um novo link</Link>
        </Button>
      </>
    );
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setServerError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setServerError(authErrorMessage(error));
      return;
    }
    toast.success("Senha alterada. Entre com a nova senha.");
    router.replace("/entrar");
  });

  return (
    <>
      <AuthHeading title="Criar nova senha" description="Por segurança, você sairá de todos os dispositivos conectados." />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError ? <FormAlert>{serverError}</FormAlert> : null}
        <Field label="Nova senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres." error={errors.password?.message} {...form.register("password")} />
        <Field label="Repita a nova senha" type="password" autoComplete="new-password" error={errors.confirm?.message} {...form.register("confirm")} />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Salvar nova senha
        </Button>
      </form>
    </>
  );
}
