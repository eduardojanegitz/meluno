import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormFallback } from "@/components/auth/auth-static";
import { googleEnabled } from "@/lib/env";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthFormFallback title="Crie sua conta" description="Leva menos de um minuto. Depois é só convidar quem divide com você." fields={3} />}>
      <SignUpForm googleEnabled={googleEnabled()} />
    </Suspense>
  );
}
