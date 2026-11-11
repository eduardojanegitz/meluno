import type { Metadata } from "next";
import { Suspense } from "react";
import { googleEnabled } from "@/lib/env";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm googleEnabled={googleEnabled()} />
    </Suspense>
  );
}
