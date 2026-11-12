/**
 * Dados do responsável pelo Meluno (controlador, na LGPD).
 * Uso gratuito por pessoa física: basta o nome e um e-mail de contato (art. 9º da LGPD).
 * Se o Meluno passar a cobrar ou for operado por empresa, acrescente CPF/CNPJ e endereço
 * (Decreto 7.962/2013) e revise o texto. Enquanto houver "[" num campo, as páginas
 * de privacidade e termos mostram um aviso de rascunho.
 */
export const LEGAL = {
  /** Seu nome (ou o da empresa, no futuro). */
  controller: "Eduardo Alves",
  /** E-mail para pedidos sobre dados pessoais. Precisa receber mensagens de verdade. */
  privacyEmail: "privacidade@meluno.com.br",
  /** Onde o app e o banco rodam. */
  hosting: "Vercel e Neon (servidores em São Paulo)",
  updatedAt: "11 de novembro de 2026",
} as const;

export const legalDraft = Object.values(LEGAL).some((v) => v.includes("["));
