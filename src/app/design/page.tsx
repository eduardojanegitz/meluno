import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignShowcase } from "./showcase";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/** Vitrine interna do design system — disponível apenas em desenvolvimento. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignShowcase />;
}
