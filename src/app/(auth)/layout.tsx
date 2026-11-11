import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Melu } from "@/components/brand/melu";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-4 sm:px-8">
        <Link href="/" aria-label="Meluno — página inicial" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo size="sm" />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[400px]">
          <Melu mood="happy" size={72} className="mb-2" />
          {children}
        </div>
      </main>
    </div>
  );
}
