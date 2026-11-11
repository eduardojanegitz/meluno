import { execSync } from "node:child_process";

/**
 * Aplica as migrations no banco de testes antes da suíte de integração.
 * Recusa-se a rodar contra um banco que não termine em "_test".
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não definida (veja .env.example).");
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL precisa apontar para um banco cujo nome termine em _test.");
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    // DIRECT_DATABASE_URL também: o prisma.config a prefere, e nunca pode apontar para outro banco aqui.
    env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
  });
}
