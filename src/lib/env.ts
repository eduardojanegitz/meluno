import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas na primeira leitura.
 * Nada aqui é exposto ao cliente (nenhuma usa o prefixo NEXT_PUBLIC_).
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    APP_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET precisa de pelo menos 32 caracteres"),
    GOOGLE_CLIENT_ID: z.string().optional().default(""),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
    RESEND_API_KEY: z.string().optional().default(""),
    EMAIL_FROM: z.string().min(3).default("Meluno <nao-responda@meluno.app>"),
    // Notificações push (Web Push/VAPID). Gere com: npx web-push generate-vapid-keys
    VAPID_PUBLIC_KEY: z.string().optional().default(""),
    VAPID_PRIVATE_KEY: z.string().optional().default(""),
    VAPID_SUBJECT: z.string().optional().default("mailto:nao-responda@meluno.app"),
    // Protege as rotas de agendamento (/api/cron/*). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
    CRON_SECRET: z.string().optional().default(""),
    // Opcional: recebe um resumo de cada erro (Slack/Discord/coletor). Nunca com dados pessoais.
    ERROR_WEBHOOK_URL: z.union([z.literal(""), z.url({ protocol: /^https$/ })]).optional().default(""),
    // Só para testes de ponta a ponta: não envia e-mail nenhum (nem exige a chave do Resend).
    EMAIL_DISABLED: z.enum(["true", "false"]).optional().default("false"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.RESEND_API_KEY && env.EMAIL_DISABLED !== "true") {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "obrigatória em produção" });
    }
  });

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

export const googleEnabled = () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
export const pushEnabled = () => Boolean(env().VAPID_PUBLIC_KEY && env().VAPID_PRIVATE_KEY);
