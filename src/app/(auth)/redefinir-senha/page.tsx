import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormFallback } from "@/components/auth/auth-ui";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthFormFallback title="Criar nova senha" description="Por segurança, você sairá de todos os dispositivos conectados." fields={2} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
