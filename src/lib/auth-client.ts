"use client";

import { createAuthClient } from "better-auth/react";

/** Cliente de autenticação do navegador (mesma origem; nenhum segredo aqui). */
export const authClient = createAuthClient();

/**
 * Mensagens em português para os códigos de erro do Better Auth.
 * Mensagens de login são propositalmente genéricas para não revelar se o e-mail existe.
 */
const messages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_EMAIL: "Esse e-mail não parece válido.",
  INVALID_PASSWORD: "E-mail ou senha incorretos.",
  USER_ALREADY_EXISTS: "Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.",
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail para entrar. Enviamos um novo link para sua caixa de entrada.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha pode ter no máximo 128 caracteres.",
  INVALID_TOKEN: "Este link é inválido ou já foi usado. Peça um novo.",
  TOKEN_EXPIRED: "Este link expirou. Peça um novo.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (!error) return "Algo deu errado. Tente novamente.";
  if (error.status === 429) return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
  return (error.code && messages[error.code]) || "Algo deu errado. Tente novamente.";
}
