import { expect, test } from "@playwright/test";
import { USERS } from "./fixtures";

test("landing e páginas legais são públicas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Privacidade" })).toBeVisible();
  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: "Termos de uso" })).toBeVisible();
});

test("sessão salva abre o Início", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: "test-results/.auth/ana.json" });
  const page = await ctx.newPage();
  await page.goto("/inicio");
  await expect(page.getByText("Olá, Ana")).toBeVisible();
});

test("senha errada não entra e não revela se o e-mail existe", async ({ page }) => {
  await page.goto("/entrar");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail", { exact: true }).fill(USERS.ana.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});

test("erros do navegador só são aceitos da própria origem", async ({ page, baseURL }) => {
  const body = { name: "TypeError", message: "x is undefined", path: "/inicio" };
  expect((await page.request.post("/api/erros", { data: body })).status()).toBe(403);
  expect((await page.request.post("/api/erros", { data: body, headers: { origin: baseURL! } })).status()).toBe(204);
});
