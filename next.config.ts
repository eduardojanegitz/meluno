import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * CSP sem nonce: nonces exigem renderização 100% dinâmica e são incompatíveis
 * com o Partial Prerendering. 'unsafe-inline' em scripts cobre o bootstrap do
 * Next e o script anti-flash do next-themes; o restante fica restrito à origem.
 * Avatares do Google (login social) são a única imagem externa.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://lh3.googleusercontent.com",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Links de convite carregam o token no caminho: nunca enviar o caminho a outros sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Páginas com token na URL nunca devem ser indexadas.
      { source: "/convites/:token", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/redefinir-senha", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
