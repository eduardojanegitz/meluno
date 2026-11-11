import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { logger } from "@/server/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Envio de e-mail transacional.
 * - Com RESEND_API_KEY: envia pelo Resend.
 * - Sem chave (apenas fora de produção — validado em env.ts): imprime o
 *   conteúdo no terminal do servidor, para que links de verificação e
 *   redefinição possam ser usados localmente.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM, NODE_ENV } = env();

  if (!RESEND_API_KEY) {
    if (NODE_ENV === "test") return;
    console.info(
      `\n┌─ E-mail (modo desenvolvimento, não enviado) ───────────\n│ Para: ${message.to}\n│ Assunto: ${message.subject}\n│\n${message.text
        .split("\n")
        .map((l) => `│ ${l}`)
        .join("\n")}\n└────────────────────────────────────────────────────────\n`,
    );
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) {
    // Não registra o destinatário nem o conteúdo (pode conter tokens).
    logger.error("email.send_failed", { name: error.name });
    throw new Error("Falha ao enviar e-mail");
  }
}
