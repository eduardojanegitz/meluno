import "server-only";

type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

/**
 * Logger estruturado mínimo. Regras:
 * - Eventos com nome estável ("expense.create_failed"), não frases.
 * - Nunca registrar senhas, tokens, e-mails, chaves Pix ou valores de formulário.
 *   Use ids internos para correlacionar.
 */
function write(level: Level, event: string, fields?: Fields) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
