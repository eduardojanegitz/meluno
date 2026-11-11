import { test as setup } from "@playwright/test";
import { USERS } from "./fixtures";
import { login } from "./helpers";

/**
 * Um login por pessoa, reaproveitado pelos testes (o app limita 5 logins por minuto).
 */
for (const [key, user] of Object.entries(USERS)) {
  setup(`login: ${key}`, async ({ page }) => {
    await login(page, user.email);
    await page.context().storageState({ path: `test-results/.auth/${key}.json` });
  });
}
