import { z } from "zod";

/**
 * Erros de domínio/aplicação. Services lançam AppError; a camada de actions
 * converte em ActionResult. Qualquer outro erro vira INTERNAL sem detalhes
 * para o cliente (o detalhe fica só no log do servidor).
 */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

const defaultMessages: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para fazer isso.",
  // Também usado para recursos de outros grupos: não revela que existem.
  NOT_FOUND: "Não encontramos o que você procurou.",
  VALIDATION: "Confira os campos destacados.",
  CONFLICT: "Isso foi alterado por outra pessoa. Atualize e tente de novo.",
  RATE_LIMITED: "Muitas tentativas em pouco tempo. Aguarde um pouco.",
  INTERNAL: "Algo deu errado do nosso lado. Tente novamente.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: AppErrorCode, message?: string, fieldErrors?: Record<string, string>) {
    super(message ?? defaultMessages[code]);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode; message: string; fieldErrors?: Record<string, string> };

/** Converte issues do Zod em { "campo.aninhado": "mensagem" } (primeira por campo). */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

export function toActionError(error: unknown): Extract<ActionResult<never>, { ok: false }> {
  if (error instanceof AppError) {
    return { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, code: "VALIDATION", message: defaultMessages.VALIDATION, fieldErrors: zodFieldErrors(error) };
  }
  return { ok: false, code: "INTERNAL", message: defaultMessages.INTERNAL };
}
