/**
 * Aceita apenas caminhos internos ("/grupos/123"); bloqueia redirecionamento
 * aberto ("//evil.com", "https://...", "/\\evil.com").
 */
export function safeNextPath(next: string | null | undefined, fallback = "/inicio"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
