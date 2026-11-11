import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { computeItemSplit, serviceAmount, SplitError } from "./split";

const amounts = (r: ReturnType<typeof computeItemSplit>) => Object.fromEntries(r.shares.map((s) => [s.memberId, s.amountMinor]));

describe("divisão por item", () => {
  it("restaurante: pizza dividida por 3, cerveja por 2, 10% de serviço e R$ 5 de couvert", () => {
    const r = computeItemSplit(
      {
        items: [
          { description: "Pizza", amountMinor: 6000, memberIds: ["ana", "bia", "caio"] },
          { description: "Cerveja", amountMinor: 3000, memberIds: ["ana", "bia"] },
          { description: "Suco", amountMinor: 1000, memberIds: ["caio"] },
        ],
        serviceBp: 1000,
        feesMinor: 500,
      },
      "exp1",
    );
    // Consumo: ana 20+15=35, bia 35, caio 20+10=30 → itens 100; serviço 10; couvert 5 → total 115.
    expect(r).toMatchObject({ itemsMinor: 10000, serviceMinor: 1000, feesMinor: 500, totalMinor: 11500 });
    expect(Object.fromEntries(r.consumed)).toEqual({ ana: 3500, bia: 3500, caio: 3000 });
    // Extras (15,00) na proporção 35:35:30 → 5,25 / 5,25 / 4,50.
    expect(amounts(r)).toEqual({ ana: 4025, bia: 4025, caio: 3450 });
  });

  it("quem não consumiu nada não paga nada — nem o serviço", () => {
    const r = computeItemSplit({ items: [{ description: "Vinho", amountMinor: 9000, memberIds: ["ana", "bia"] }], serviceBp: 1000, feesMinor: 0 }, "x");
    expect(amounts(r)).toEqual({ ana: 4950, bia: 4950 });
    expect(r.shares.find((s) => s.memberId === "caio")).toBeUndefined();
  });

  it("serviço arredonda meio-para-cima no centavo", () => {
    expect(serviceAmount(1005, 1000)).toBe(101); // 100,5 → 101
    expect(serviceAmount(1004, 1000)).toBe(100); // 100,4 → 100
    expect(serviceAmount(3333, 1250)).toBe(417); // 416,625 → 417
  });

  it("recusa item sem ninguém, taxa fora do limite e lista vazia", () => {
    expect(() => computeItemSplit({ items: [], serviceBp: 0, feesMinor: 0 }, "s")).toThrow(SplitError);
    expect(() => computeItemSplit({ items: [{ description: "X", amountMinor: 100, memberIds: [] }], serviceBp: 0, feesMinor: 0 }, "s")).toThrow(/Escolha quem consumiu/);
    expect(() => computeItemSplit({ items: [{ description: "X", amountMinor: 100, memberIds: ["a"] }], serviceBp: 3001, feesMinor: 0 }, "s")).toThrow(/30%/);
  });

  it("propriedade: a soma das partes é sempre exatamente o total, e ninguém paga menos do que consumiu", () => {
    const people = ["a", "b", "c", "d", "e"];
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amountMinor: fc.integer({ min: 1, max: 500_000 }),
            memberIds: fc.subarray(people, { minLength: 1 }),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        fc.integer({ min: 0, max: 3000 }),
        fc.integer({ min: 0, max: 50_000 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        (items, serviceBp, feesMinor, seed) => {
          const r = computeItemSplit({ items: items.map((i, n) => ({ ...i, description: `i${n}` })), serviceBp, feesMinor }, seed);
          const sum = r.shares.reduce((s, x) => s + x.amountMinor, 0);
          expect(sum).toBe(r.totalMinor);
          expect(r.totalMinor).toBe(r.itemsMinor + r.serviceMinor + feesMinor);
          for (const s of r.shares) expect(s.amountMinor).toBeGreaterThanOrEqual(r.consumed.get(s.memberId)!);
          // Determinístico: recalcular dá o mesmo resultado.
          expect(computeItemSplit({ items: items.map((i, n) => ({ ...i, description: `i${n}` })), serviceBp, feesMinor }, seed).shares).toEqual(r.shares);
        },
      ),
      { numRuns: 300 },
    );
  });
});
