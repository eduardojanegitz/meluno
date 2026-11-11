import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { env, googleEnabled } from "@/lib/env";
import { sendEmail } from "@/server/email/mailer";
import { resetPasswordMessage, verifyEmailMessage } from "@/server/email/templates";
import { logger } from "@/server/logger";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/** Dispara o e-mail sem bloquear a resposta (evita revelar, pelo tempo, se a conta existe). */
function dispatch(promise: Promise<void>, event: string) {
  promise.catch(() => logger.error(event));
}

function createAuth() {
  const { APP_URL, BETTER_AUTH_SECRET, NODE_ENV, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();

  return betterAuth({
    appName: "Meluno",
    baseURL: APP_URL,
    secret: BETTER_AUTH_SECRET,
    trustedOrigins: [APP_URL],
    database: prismaAdapter(db, { provider: "postgresql" }),
    telemetry: { enabled: false },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: HOUR,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        dispatch(sendEmail(resetPasswordMessage(user.email, url)), "auth.reset_email_failed");
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: DAY,
      sendVerificationEmail: async ({ user, url }) => {
        dispatch(sendEmail(verifyEmailMessage(user.email, user.name, url)), "auth.verify_email_failed");
      },
    },

    socialProviders: googleEnabled()
      ? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, prompt: "select_account" } }
      : {},

    account: {
      accountLinking: {
        enabled: true,
        // O Google só devolve e-mails verificados; vincular à conta existente é seguro...
        trustedProviders: ["google"],
        // ...desde que o e-mail da conta local também esteja confirmado. Sem isso, alguém
        // poderia criar uma conta com o e-mail de outra pessoa e esperar o dono entrar
        // pelo Google para herdar o acesso pela senha (pre-account takeover).
        requireLocalEmailVerified: true,
        // Conectar pelo Perfil exige o mesmo e-mail do cadastro.
        allowDifferentEmails: false,
      },
    },

    session: {
      expiresIn: 30 * DAY,
      updateAge: DAY,
    },

    rateLimit: {
      enabled: NODE_ENV !== "test",
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: HOUR, max: 10 },
        "/request-password-reset": { window: HOUR, max: 5 },
        "/reset-password": { window: HOUR, max: 10 },
        "/send-verification-email": { window: 10 * 60, max: 3 },
        "/change-password": { window: HOUR, max: 10 },
      },
    },

    advanced: {
      useSecureCookies: NODE_ENV === "production",
      cookiePrefix: "meluno",
    },

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db.userPreferences.upsert({
              where: { userId: user.id },
              create: { userId: user.id },
              update: {},
            });
          },
        },
      },
    },

    // Precisa ser o último plugin: grava cookies a partir de Server Actions.
    plugins: [nextCookies()],
  });
}

const globalForAuth = globalThis as unknown as { auth?: ReturnType<typeof createAuth> };
export const auth = globalForAuth.auth ?? createAuth();
if (env().NODE_ENV !== "production") globalForAuth.auth = auth;

export type AuthSession = typeof auth.$Infer.Session;
