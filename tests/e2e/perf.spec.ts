import { expect, test, type Page } from "@playwright/test";

/**
 * Desempenho no celular, com CPU 4x mais lenta e rede "4G lenta" (como o Lighthouse mobile).
 * Limites: LCP ≤ 4 s e CLS ≤ 0,1. Os números medidos aparecem no relatório.
 */
async function measure(page: Page, path: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const { lcp, cls } = await page.evaluate(() => ({ lcp: (window as unknown as { __lcp: number }).__lcp, cls: (window as unknown as { __cls: number }).__cls }));
  test.info().annotations.push({ type: "web-vitals", description: `${path}: LCP ${Math.round(lcp)} ms, CLS ${cls.toFixed(3)}` });
  console.log(`[web-vitals] ${path}: LCP ${Math.round(lcp)} ms, CLS ${cls.toFixed(3)}`);
  expect(lcp, `LCP de ${path}`).toBeLessThanOrEqual(4000);
  expect(cls, `CLS de ${path}`).toBeLessThanOrEqual(0.1);
}

test("landing", ({ page }) => measure(page, "/"));
test("entrar", ({ page }) => measure(page, "/entrar"));
test("criar conta", ({ page }) => measure(page, "/criar-conta"));

test.describe("logado", () => {
  test.use({ storageState: "test-results/.auth/ana.json" });
  test("início", ({ page }) => measure(page, "/inicio"));
  test("grupos", ({ page }) => measure(page, "/grupos"));
  test("perfil", ({ page }) => measure(page, "/perfil"));
});
