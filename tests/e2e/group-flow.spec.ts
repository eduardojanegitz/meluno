import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import type { USERS } from "./fixtures";
import { USERS as PEOPLE } from "./fixtures";
import { expectAccessible } from "./helpers";

/**
 * Fluxo principal com duas pessoas, na ordem em que acontece de verdade:
 * grupo → convite → chave Pix → despesa com comprovante → Pix → confirmação → "Tudo quite".
 */
test.describe.configure({ mode: "serial" });

let groupUrl = "";
let invitePath = "";

/** Sessão já logada (auth.setup.ts) da pessoa, num contexto separado. */
async function as(browser: Browser, who: keyof typeof USERS): Promise<Page> {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR", storageState: `test-results/.auth/${who}.json` });
  return ctx.newPage();
}

test("Ana cria o grupo e gera o convite; Bia entra pelo link", async ({ browser }) => {
  const ana = await as(browser, "ana");
  await ana.goto("/grupos/novo");
  await ana.getByLabel("Nome do grupo").fill("Viagem E2E");
  await ana.getByRole("button", { name: "Criar grupo" }).click();
  await expect(ana).toHaveURL(/\/grupos\/[0-9a-f-]{36}$/);
  groupUrl = new URL(ana.url()).pathname;

  await ana.goto(`${groupUrl}/configuracoes`);
  await ana.getByRole("button", { name: "Gerar link" }).click();
  const invite = await ana.getByLabel("Link de convite").inputValue();
  expect(invite).toContain("/convites/");
  invitePath = new URL(invite).pathname;

  // Botões de compartilhar: WhatsApp com a mensagem pronta e QR Code em tela grande.
  const wa = ana.getByRole("link", { name: "WhatsApp" });
  const href = (await wa.getAttribute("href"))!;
  expect(href.startsWith("https://wa.me/?text=")).toBe(true);
  expect(decodeURIComponent(href)).toContain("“Viagem E2E”");
  expect(decodeURIComponent(href)).toContain(invite);
  await ana.getByRole("button", { name: "QR Code" }).click();
  await expect(ana.getByRole("img", { name: "QR Code do convite para Viagem E2E" })).toBeVisible();
  await ana.keyboard.press("Escape");

  const bia = await as(browser, "bia");
  await bia.goto(new URL(invite).pathname);
  await bia.getByRole("button", { name: "Entrar no grupo" }).click();
  await expect(bia).toHaveURL(new RegExp(`${groupUrl}$`));
});

test("link de convite sem login: prévia com o grupo, metadados e imagem para o WhatsApp", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR" });
  const page = await ctx.newPage();
  const res = await page.goto(invitePath);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Viagem E2E" })).toBeVisible();
  await expect(page.getByText("Ana E2E convidou você para", { exact: true })).toBeVisible();
  const signup = page.getByRole("link", { name: "Criar conta e entrar no grupo" });
  expect(await signup.getAttribute("href")).toBe(`/criar-conta?next=${encodeURIComponent(invitePath)}`);

  // O que o robô do WhatsApp lê (ele recebe os metadados no <head>).
  const bot = await ctx.request.get(invitePath, { headers: { "user-agent": "WhatsApp/2.23.20.0 A" } });
  const html = await bot.text();
  expect(html).toMatch(/<meta property="og:title" content="Ana E2E convidou você para “Viagem E2E”"/);
  expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  expect(image).toBeTruthy();
  const png = await ctx.request.get(image!.replace(/^https?:\/\/[^/]+/, ""));
  expect(png.headers()["content-type"]).toBe("image/png");
  (await import("node:fs")).writeFileSync("test-results/convite-og.png", await png.body());
  await ctx.close();
});

test("Bia cadastra a chave Pix e lança o jantar com comprovante", async ({ browser }) => {
  const bia = await as(browser, "bia");
  await bia.goto("/perfil");
  await bia.getByLabel("Tipo de chave").selectOption("EMAIL");
  await bia.getByLabel("Chave Pix").fill(PEOPLE.bia.email);
  await bia.getByRole("button", { name: "Adicionar" }).click();
  await expect(bia.getByText("Chave adicionada")).toBeVisible();

  await bia.goto(`${groupUrl}/despesas/nova`);
  // Digitar antes da hidratação faz o React descartar o que foi digitado.
  await bia.waitForLoadState("networkidle");
  // O campo de valor é digitado em centavos, como no caixa: 1-0-0-0-0 → R$ 100,00.
  await bia.locator("#amount").pressSequentially("10000");
  await bia.getByLabel("Descrição").fill("Jantar");
  await bia.getByRole("button", { name: "Salvar despesa" }).click();
  await expect(bia).toHaveURL(new RegExp(`${groupUrl}$`));

  await bia.getByRole("link", { name: /Jantar/ }).first().click();
  await expect(bia.getByRole("heading", { name: "Comprovante" })).toBeVisible();

  // JPEG de verdade gerado no próprio navegador (o upload passa pela compressão do app).
  const jpeg = await bia.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 900;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 600, 900);
    ctx.fillStyle = "#000";
    ctx.font = "40px monospace";
    ctx.fillText("CUPOM E2E", 120, 120);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1]!;
  });
  await bia.locator('input[type="file"]').setInputFiles({ name: "cupom.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg, "base64") });
  await expect(bia.getByText("Comprovante anexado")).toBeVisible();
  const img = bia.getByRole("button", { name: "Ver comprovante" }).locator("img");
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test("Ana paga com Pix, Bia confirma e o grupo fica quite", async ({ browser }) => {
  const ana = await as(browser, "ana");
  await ana.goto(`${groupUrl}?aba=saldos`);
  await ana.getByRole("button", { name: "Pagar com Pix" }).click();
  const dialog = ana.getByRole("dialog");
  await expect(dialog).toContainText("R$ 50,00");
  await expect(dialog.locator("textarea, input, code, pre").filter({ hasText: /br\.gov\.bcb\.pix/i }).or(dialog.getByText(/br\.gov\.bcb\.pix/i))).toBeVisible();
  await dialog.getByRole("button", { name: "Já paguei" }).click();
  await expect(dialog).toBeHidden();

  const bia = await as(browser, "bia");
  await bia.goto(`${groupUrl}?aba=saldos`);
  await bia.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(bia.getByText("Tudo quite!")).toBeVisible();
});

test("aba Gastos: total, categoria e parte de cada um", async ({ browser }) => {
  for (const scheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR", colorScheme: scheme, storageState: "test-results/.auth/ana.json" });
    const ana = await ctx.newPage();
    await ana.goto(`${groupUrl}?aba=gastos`);
    const tab = ana.getByRole("tabpanel");
    await expect(tab.getByText("Total do grupo")).toBeVisible();
    await expect(tab.getByText("R$ 100,00").first()).toBeVisible();
    await expect(tab.getByRole("heading", { name: "Por categoria" })).toBeVisible();
    await expect(tab.getByText("Alimentação").first()).toBeVisible();
    await expect(tab.getByRole("heading", { name: "Parte de cada um" })).toBeVisible();
    await expect(tab.getByText("pagou R$ 100,00")).toBeVisible();
    await expectAccessible(ana, `gastos ${scheme}`);
    await ana.screenshot({ path: `test-results/gastos-${scheme}.png`, fullPage: true });
    await tab.getByRole("button", { name: "Ver como tabela" }).click();
    await expect(tab.getByRole("table")).toHaveCount(3);
    await ctx.close();
  }
});

test("telas do grupo com dados são acessíveis", async ({ browser }) => {
  const ana = await as(browser, "ana");
  for (const path of [groupUrl, `${groupUrl}?aba=saldos`, `${groupUrl}/despesas/nova`, `${groupUrl}/configuracoes`]) {
    await ana.goto(path);
    await expectAccessible(ana, path);
  }
  await ana.goto(groupUrl);
  await ana.getByRole("link", { name: /Jantar/ }).first().click();
  await expect(ana.getByRole("heading", { name: "Comprovante" })).toBeVisible();
  await expectAccessible(ana, "detalhe da despesa");
});

test("quem não é do grupo não vê nada dele (404)", async ({ browser }) => {
  const zeca = await as(browser, "zeca");
  // Com streaming o status já saiu como 200; o que importa é não mostrar nada do grupo.
  await zeca.goto(groupUrl);
  await expect(zeca.getByRole("heading", { name: "Não encontramos essa página" })).toBeVisible();
  await expect(zeca.getByText("Viagem E2E")).toHaveCount(0);
  await expect(zeca.getByText("Jantar")).toHaveCount(0);
  const csv = await zeca.request.get(`/api/grupos${groupUrl.replace("/grupos", "")}/exportar`);
  expect(csv.status()).toBe(404);
});

test("despesa em dólar: cotação digitada, convertido nos saldos e na lista", async ({ browser }) => {
  const ana = await as(browser, "ana");
  await ana.goto(`${groupUrl}/despesas/nova`);
  await ana.waitForLoadState("networkidle");
  await ana.getByRole("button", { name: "Paguei em outra moeda" }).click();
  await ana.getByLabel("Moeda", { exact: true }).selectOption("USD");
  await ana.locator("#fx-amount").pressSequentially("5000");
  await ana.getByLabel(/Cotação: 1 USD/).fill("5,5517");
  await expect(ana.locator("#amount")).toContainText("R$ 277,59");
  await ana.getByLabel("Descrição").fill("Táxi do aeroporto");
  await ana.screenshot({ path: "test-results/outra-moeda.png", fullPage: true });
  await ana.getByRole("button", { name: "Salvar despesa" }).click();
  await expect(ana).toHaveURL(new RegExp(`${groupUrl}$`));
  const row = ana.getByRole("link", { name: /Táxi do aeroporto/ });
  await expect(row).toContainText("R$ 277,59");
  await expect(row).toContainText(/US\$\s?50,00/);
  await row.click();
  await expect(ana.getByText(/cotação 5,5517 BRL por USD/)).toBeVisible();
  await expectAccessible(ana, "detalhe em outra moeda");
});
