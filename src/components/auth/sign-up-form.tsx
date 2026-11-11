"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { motion } from "motion/react";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { signUpSchema } from "@/schemas/auth";
import { AuthHeading, Divider, Field, FormAlert } from "./auth-ui";
import { GoogleButton } from "./google-button";

type Values = z.input<typeof signUpSchema>;
type Parsed = z.output<typeof signUpSchema>;

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await authClient.signUp.email({ ...values, callbackURL: "/inicio" });
    if (error) {
      setServerError(authErrorMessage(error));
      return;
    }
    setSentTo(values.email);
  });

  if (sentTo) return <CheckInbox email={sentTo} />;

  return (
    <>
      <AuthHeading title="Crie sua conta" description="Leva menos de um minuto. Depois é só convidar quem divide com você." />
      {googleEnabled ? (
        <>
          <GoogleButton label="Continuar com Google" callbackURL="/inicio" />
          <Divider>ou com e-mail</Divider>
        </>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError ? <FormAlert>{serverError}</FormAlert> : null}
        <Field label="Nome" autoComplete="name" error={errors.name?.message} {...form.register("name")} />
        <Field label="E-mail" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...form.register("email")} />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres."
          error={errors.password?.message}
          {...form.register("password")}
        />
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Criar conta
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-foreground font-semibold underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

function CheckInbox({ email }: { email: string }) {
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/inicio" });
    setSending(false);
    if (error) toast.error(authErrorMessage(error));
    else toast.success("Enviamos um novo link.");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      <div className="bg-mint/60 dark:bg-mint/15 mx-auto mb-6 flex size-16 items-center justify-center rounded-3xl">
        <MailCheck className="text-ink dark:text-mint size-7" aria-hidden="true" />
      </div>
      <h1 className="text-[26px] leading-tight font-extrabold">Confira seu e-mail</h1>
      <p className="text-muted-foreground mt-3 text-[15px]">
        Enviamos um link de confirmação para <span className="text-foreground font-semibold break-all">{email}</span>. Abra-o
        para ativar sua conta.
      </p>
      <div className="mt-8 space-y-3">
        <Button variant="outline" className="w-full" onClick={resend} disabled={sending}>
          {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Reenviar e-mail
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/entrar">Já confirmei, quero entrar</Link>
        </Button>
      </div>
      <p className="text-muted-foreground mt-6 text-xs">Não encontrou? Verifique a caixa de spam ou promoções.</p>
    </motion.div>
  );
}
