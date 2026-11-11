import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormFallback, GoogleLegalNote } from "@/components/auth/auth-ui";
import { googleEnabled } from "@/lib/env";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <>
      <Suspense fallback={<AuthFormFallback title="Que bom te ver" description="Entre para ver seus grupos e saldos." fields={2} />}>
        <SignInForm googleEnabled={googleEnabled()} />
      </Suspense>
      {/* Fora do Suspense: texto fixo que já vem no HTML (era o maior bloco da tela e atrasava o LCP). */}
      {googleEnabled() ? <GoogleLegalNote /> : null}
    </>
  );
}
