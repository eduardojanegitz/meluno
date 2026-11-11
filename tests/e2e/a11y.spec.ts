import { test } from "@playwright/test";
import { expectAccessible } from "./helpers";

/**
 * Acessibilidade automática nas telas principais, em claro e escuro.
 * Telas de grupo (com dados) são verificadas em group-flow.spec.ts.
 */
const PUBLIC = ["/", "/entrar", "/criar-conta", "/privacidade"];
const PRIVATE = ["/inicio", "/grupos", "/atividade", "/perfil", "/grupos/novo"];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`deslogado (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PUBLIC) test(`a11y ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectAccessible(page, `${path} ${scheme}`);
    });
  });
  test.describe(`logado (${scheme})`, () => {
    test.use({ colorScheme: scheme, storageState: "test-results/.auth/ana.json" });
    for (const path of PRIVATE) test(`a11y ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectAccessible(page, `${path} ${scheme}`);
    });
  });
}
