import { devices, expect, test } from "@playwright/test";
import { E2E_PASSWORD } from "./fixtures";

/** Lia existe só para este teste: a conta é excluída no fim. */
test("Lia baixa os próprios dados e exclui a conta", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR", storageState: "test-results/.auth/lia.json" });
  const page = await ctx.newPage();
  await page.goto("/perfil");
  await page.waitForLoadState("networkidle");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar meus dados" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^meluno-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await (await import("node:fs/promises")).readFile((await file.path())!, "utf8"));
  expect(data.account.name).toBe("Lia E2E");
  expect(JSON.stringify(data)).not.toMatch(/"password"|accessToken/);

  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await page.getByLabel("Sua senha").fill(E2E_PASSWORD);
  await page.getByLabel(/EXCLUIR/).fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page).toHaveURL(/\/conta-excluida/);

  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/entrar/);
});
