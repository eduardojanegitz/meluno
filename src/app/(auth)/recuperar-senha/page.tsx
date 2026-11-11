import type { Metadata } from "next";
import { RequestResetForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RequestResetPage() {
  return <RequestResetForm />;
}
