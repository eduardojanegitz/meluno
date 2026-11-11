/**
 * Dados do responsável pelo Meluno (controlador, na LGPD).
 * Preencha antes de publicar. Enquanto houver "[" em algum campo, as páginas
 * de privacidade e termos mostram um aviso de rascunho.
 */
export const LEGAL = {
  /** Nome da pessoa ou empresa responsável. */
  controller: "[NOME DO RESPONSÁVEL]",
  /** CPF ou CNPJ. */
  document: "[CPF OU CNPJ]",
  /** E-mail para pedidos sobre dados pessoais (encarregado/DPO ou o próprio responsável). */
  privacyEmail: "[E-MAIL DE CONTATO]",
  /** Cidade/UF do foro. */
  forum: "[CIDADE/UF]",
  /** Provedores de hospedagem e banco de dados (ex.: "Vercel (EUA) e Neon (EUA)"). */
  hosting: "[PROVEDOR DE HOSPEDAGEM E BANCO DE DADOS]",
  updatedAt: "11 de novembro de 2026",
} as const;

export const legalDraft = Object.values(LEGAL).some((v) => v.includes("["));
