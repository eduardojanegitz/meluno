import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src,
      // "server-only" lança erro fora do bundler do Next; nos testes é inócuo.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/support/global-setup.ts"],
          // Os services usam o cliente da aplicação: aponta-o para o banco de testes.
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "", NODE_ENV: "test" },
          // Testes de integração compartilham um banco: execução sequencial.
          fileParallelism: false,
        },
      },
    ],
  },
});
