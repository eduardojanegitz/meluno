import type { Metadata } from "next";
import { googleEnabled } from "@/lib/env";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return <SignUpForm googleEnabled={googleEnabled()} />;
}
