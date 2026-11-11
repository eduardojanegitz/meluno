import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { createExpense, getExpense, updateExpense } from "@/server/services/expenses";
import { getGroupDetail } from "@/server/services/queries";
import { exportGroupCsv } from "@/server/services/group-export";
import { suggestRate } from "@/server/services/fx";
import { createTestDb, resetDb } from "../support/db";
import { makeGroup, makeUser, memberOf } from "../support/factories";

const admin = createTestDb();
const validation = (e: unknown) => e instanceof AppError && e.code === "VALIDATION";

describe("despesa em outra moeda (integração)", () => {
  beforeEach(() => resetDb(admin));
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  async function setup() {
    const ana = await makeUser("Ana");
    const bia = await makeUser("Bia");
    const g = await makeGroup(ana, [bia], "Nova York");
    return { ana, bia, g, ma: await memberOf(ana, g), mb: await memberOf(bia, g) };
  }

  const dinner = (g: string, ma: string, mb: string, amountMinor: number, foreign?: { currency: "USD" | "BRL" | "JPY"; amountMinor: number; rate: string }) => ({
    groupId: g,
    expenseId: randomUUID(),
    description: "Jantar",
    amountMinor,
    date: "2026-11-10",
    payers: [{ memberId: ma, amountMinor }],
    split: { method: "EQUAL" as const, entries: [{ memberId: ma }, { memberId: mb }] },
    foreign,
  });

  it("US$ 50,00 a 5,5517 vira R$ 277,59; saldos e lista usam o convertido", async () => {
    const { ana, g, ma, mb } = await setup();
    const { expenseId } = await createExpense(ana, dinner(g, ma.id, mb.id, 27759, { currency: "USD", amountMinor: 5000, rate: "5,5517" }));
    const { expense } = await getExpense(ana, g, expenseId);
    expect(expense.amountMinor).toBe(27759);
    expect(expense.foreign).toEqual({ currency: "USD", amountMinor: 5000, rate: "5,5517" });

    const detail = await getGroupDetail(ana, g);
    expect(detail.expenses[0]!.originalLabel).toMatch(/US\$\s?50,00/);
    // R$ 277,59 entre 2: 138,79 + 138,80. Quem fica com o centavo extra depende do id (ADR 0003).
    const bal = Object.fromEntries(detail.members.map((m) => [m.id, m.balanceMinor]));
    expect(bal[ma.id]).toBe(-bal[mb.id]!);
    expect([13879, 13880]).toContain(bal[ma.id]);

    const { csv } = await exportGroupCsv(ana, g);
    expect(csv.split("\r\n")[1]).toMatch(/;USD;50,00;5,5517$/);
  });

  it("o servidor recalcula: convertido diferente, mesma moeda do grupo, por item ou repetindo são recusados", async () => {
    const { ana, g, ma, mb } = await setup();
    await expect(createExpense(ana, dinner(g, ma.id, mb.id, 27700, { currency: "USD", amountMinor: 5000, rate: "5,5517" }))).rejects.toSatisfy(validation);
    await expect(createExpense(ana, dinner(g, ma.id, mb.id, 5000, { currency: "BRL", amountMinor: 5000, rate: "1" }))).rejects.toSatisfy(validation);
    await expect(createExpense(ana, dinner(g, ma.id, mb.id, 27759, { currency: "USD", amountMinor: 5000, rate: "abc" }))).rejects.toSatisfy(validation);
    await expect(createExpense(ana, { ...dinner(g, ma.id, mb.id, 27759, { currency: "USD", amountMinor: 5000, rate: "5,5517" }), repeat: "MONTHLY" })).rejects.toThrow();
  });

  it("iene (sem centavos): ¥10.000 a 0,0379 = R$ 379,00", async () => {
    const { ana, g, ma, mb } = await setup();
    const { expenseId } = await createExpense(ana, dinner(g, ma.id, mb.id, 37900, { currency: "JPY", amountMinor: 10000, rate: "0,0379" }));
    expect((await getExpense(ana, g, expenseId)).expense.amountMinor).toBe(37900);
  });

  it("editar e voltar para a moeda do grupo apaga o valor original e a cotação", async () => {
    const { ana, g, ma, mb } = await setup();
    const input = dinner(g, ma.id, mb.id, 27759, { currency: "USD", amountMinor: 5000, rate: "5,5517" });
    await createExpense(ana, input);
    await updateExpense(ana, { ...input, version: 1, amountMinor: 30000, payers: [{ memberId: ma.id, amountMinor: 30000 }], foreign: undefined });
    const { expense } = await getExpense(ana, g, input.expenseId);
    expect(expense).toMatchObject({ amountMinor: 30000, foreign: null });
  });

  it("o banco barra moeda original igual à do grupo e campos pela metade", async () => {
    const { ana, g, ma, mb } = await setup();
    const { expenseId } = await createExpense(ana, dinner(g, ma.id, mb.id, 1000));
    await expect(admin.$executeRawUnsafe(`UPDATE expense SET "originalCurrency"='BRL', "originalAmountMinor"=1000, "exchangeRateE10"=10000000000 WHERE id='${expenseId}'`)).rejects.toThrow(/foreign_currency_coherence/);
    await expect(admin.$executeRawUnsafe(`UPDATE expense SET "originalCurrency"='USD' WHERE id='${expenseId}'`)).rejects.toThrow(/foreign_currency_coherence/);
  });

  it("cotação sugerida: só moedas do BCE; falha da API não quebra nada", async () => {
    const { ana } = await setup();
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => Response.json({ amount: 1, base: "USD", date: "2026-11-10", rates: { BRL: 5.5517 } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await suggestRate(ana, { from: "USD", to: "BRL", date: "2026-11-10" })).toEqual({ available: true, rate: "5,5517", date: "2026-11-10" });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://api.frankfurter.dev/v1/2026-11-10?base=USD&symbols=BRL");

    expect(await suggestRate(ana, { from: "ARS", to: "BRL", date: "2026-11-10" })).toEqual({ available: false });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    expect(await suggestRate(ana, { from: "EUR", to: "BRL", date: "2026-11-09" })).toEqual({ available: false });
  });
});
