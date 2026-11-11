/**
 * Usuários de teste dos testes de ponta a ponta. Existem só no banco meluno_e2e,
 * recriado a cada execução. Senha de teste, sem uso fora daqui.
 */
export const E2E_PASSWORD = "senha-de-teste-e2e-1234";

export const USERS = {
  ana: { name: "Ana E2E", email: "ana@e2e.test" },
  bia: { name: "Bia E2E", email: "bia@e2e.test" },
  zeca: { name: "Zeca E2E", email: "zeca@e2e.test" },
  /** Só para o teste de exclusão de conta. */
  lia: { name: "Lia E2E", email: "lia@e2e.test" },
} as const;

export const E2E_PORT = 3100;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://meluno:meluno_dev@localhost:5432/meluno_e2e";
