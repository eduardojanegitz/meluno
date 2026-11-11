import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Display arredondada: dá o tom brincalhão sem perder legibilidade. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Meluno — Compartilhe momentos. Não complicações.",
    template: "%s · Meluno",
  },
  description:
    "Organize gastos, compartilhe contas e descubra quem deve para quem. Tudo em um só lugar.",
  applicationName: "Meluno",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  appleWebApp: { capable: true, title: "Meluno", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Meluno",
    title: "Meluno — Compartilhe momentos. Não complicações.",
    description: "Organize gastos, compartilhe contas e descubra quem deve para quem.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8ee" },
    { media: "(prefers-color-scheme: dark)", color: "#112230" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${nunito.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
