/**
 * Remove dados pessoais prováveis de textos de erro antes de registrar:
 * e-mails, ids (UUID), tokens longos e sequências de dígitos (CPF, telefone, chave Pix, valores).
 */
export function scrub(text: string, max = 200): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token]")
    .replace(/\d[\d.\-/() ]{5,}\d/g, "[número]")
    .slice(0, max);
}

/** Tira query string e troca ids no caminho por ":id" (/grupos/0193…/despesas → /grupos/:id/despesas). */
export function routeOf(path: string): string {
  return path.split(/[?#]/)[0]!.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "/:id").replace(/\/convites\/[^/]+/, "/convites/:token").slice(0, 120);
}
