import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_PORT } from "./tests/e2e/fixtures";

/**
 * Testes de ponta a ponta contra o build de produção (`next start`), num banco próprio
 * (meluno_e2e), sem enviar e-mails. Rode `npm run test:e2e` (faz o build antes).
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "celular", testMatch: /\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/entrar`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      DIRECT_DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: `http://localhost:${E2E_PORT}`,
      EMAIL_DISABLED: "true",
      CRON_SECRET: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});
