import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { apportion, computeSplit, PayerError, SplitError, validatePayers } from "./split";

const amounts = (shares: { memberId: string; amountMinor: number }[]) =>
  Object.fromEntries(shares.map((s) => [s.memberId, s.amountMinor]));

describe("divisão igualitária", () => {
  it("cenário 1 — R$ 150,00 entre três: R$ 50,00 cada", () => {
    const r = computeSplit(15000, { method: "EQUAL", entries: [{ memberId: "joao" }, { memberId: "maria" }, { memberId: "pedro" }] }, "exp1");
    expect(amounts(r)).toEqual({ joao: 5000, maria: 5000, pedro: 5000 });
  });

  it("cenário 2 — R$ 100,00 entre três: 33,34 + 33,33 + 33,33, fechando o total", () => {
    const r = computeSplit(10000, { method: "EQUAL", entries: [{ memberId: "a" }, { memberId: "b" }, { memberId: "c" }] }, "exp1");
    const values = r.map((s) => s.amountMinor).sort((x, y) => y - x);
    expect(values).toEqual([3334, 3333, 3333]);
    expect(values.reduce((a, b) => a + b)).toBe(10000);
  });

  it("R$ 0,02 entre três: duas pessoas pagam 1 centavo, uma paga 0", () => {
    const r = computeSplit(2, { method: "EQUAL", entries: [{ memberId: "a" }, { memberId: "b" }, { memberId: "c" }] }, "x");
    expect(r.map((s) => s.amountMinor).sort()).toEqual([0, 1, 1]);
  });

  it("é determinístico: a mesma despesa sempre gera o mesmo resultado", () => {
    const req = { method: "EQUAL" as const, entries: [{ memberId: "a" }, { memberId: "b" }, { memberId: "c" }] };
    expect(computeSplit(10000, req, "exp-42")).toEqual(computeSplit(10000, req, "exp-42"));
    // A ordem de entrada não muda quem recebe o centavo extra.
    const reversed = { ...req, entries: [...req.entries].reverse() };
    expect(amounts(computeSplit(10000, reversed, "exp-42"))).toEqual(amounts(computeSplit(10000, req, "exp-42")));
  });

  it("alterna quem absorve o centavo extra entre despesas diferentes", () => {
    const req = { method: "EQUAL" as const, entries: [{ memberId: "a" }, { memberId: "b" }, { memberId: "c" }] };
    const extra = new Map<string, number>();
    for (let i = 0; i < 300; i++) {
      for (const s of computeSplit(100, req, `exp-${i}`)) {
        if (s.amountMinor === 34) extra.set(s.memberId, (extra.get(s.memberId) ?? 0) + 1);
      }
    }
    // Cada pessoa recebe o centavo extra em uma fração razoável das vezes.
    for (const id of ["a", "b", "c"]) expect(extra.get(id) ?? 0).toBeGreaterThan(60);
  });
});

describe("divisão percentual", () => {
  it("cenário 3 — 50% / 30% / 20% de R$ 150,00", () => {
    const r = computeSplit(
      15000,
      { method: "PERCENT", entries: [{ memberId: "joao", value: 5000 }, { memberId: "maria", value: 3000 }, { memberId: "pedro", value: 2000 }] },
      "e",
    );
    expect(amounts(r)).toEqual({ joao: 7500, maria: 4500, pedro: 3000 });
  });

  it("33,33% / 33,33% / 33,34% de R$ 10,00 fecha exatamente o total", () => {
    const r = computeSplit(1000, { method: "PERCENT", entries: [{ memberId: "a", value: 3333 }, { memberId: "b", value: 3333 }, { memberId: "c", value: 3334 }] }, "e");
    expect(r.reduce((acc, s) => acc + s.amountMinor, 0)).toBe(1000);
    expect(amounts(r).c).toBe(334);
  });

  it("rejeita porcentagens que não somam 100%, informando a diferença", () => {
    const run = () => computeSplit(1000, { method: "PERCENT", entries: [{ memberId: "a", value: 5000 }, { memberId: "b", value: 4000 }] }, "e");
    expect(run).toThrow(SplitError);
    try {
      run();
    } catch (e) {
      expect((e as SplitError).code).toBe("PERCENT_SUM_MISMATCH");
      expect((e as SplitError).difference).toBe(1000); // faltam 10%
    }
  });
});

describe("divisão por partes", () => {
  it("cenário 4 — 2 / 1 / 1 partes de R$ 100,00", () => {
    const r = computeSplit(
      10000,
      { method: "SHARES", entries: [{ memberId: "joao", value: 200 }, { memberId: "maria", value: 100 }, { memberId: "pedro", value: 100 }] },
      "e",
    );
    expect(amounts(r)).toEqual({ joao: 5000, maria: 2500, pedro: 2500 });
  });

  it("aceita partes fracionárias (1,5 parte)", () => {
    const r = computeSplit(10000, { method: "SHARES", entries: [{ memberId: "a", value: 150 }, { memberId: "b", value: 50 }] }, "e");
    expect(amounts(r)).toEqual({ a: 7500, b: 2500 });
  });

  it("quem tem 0 partes não paga nada, nem centavo de arredondamento", () => {
    const r = computeSplit(100, { method: "SHARES", entries: [{ memberId: "a", value: 100 }, { memberId: "b", value: 100 }, { memberId: "c", value: 100 }, { memberId: "z", value: 0 }] }, "e");
    expect(amounts(r).z).toBe(0);
    expect(r.reduce((acc, s) => acc + s.amountMinor, 0)).toBe(100);
  });

  it("rejeita quando todos têm 0 partes", () => {
    expect(() => computeSplit(100, { method: "SHARES", entries: [{ memberId: "a", value: 0 }] }, "e")).toThrow(/peso maior que zero/);
  });
});

describe("divisão por valores personalizados", () => {
  it("cenário 5 — João 30, Maria 50, Pedro 70 = R$ 150,00", () => {
    const r = computeSplit(
      15000,
      { method: "EXACT", entries: [{ memberId: "joao", value: 3000 }, { memberId: "maria", value: 5000 }, { memberId: "pedro", value: 7000 }] },
      "e",
    );
    expect(amounts(r)).toEqual({ joao: 3000, maria: 5000, pedro: 7000 });
  });

  it("rejeita soma diferente do total, informando quanto falta", () => {
    try {
      computeSplit(15000, { method: "EXACT", entries: [{ memberId: "a", value: 3000 }, { memberId: "b", value: 5000 }] }, "e");
      expect.unreachable();
    } catch (e) {
      expect((e as SplitError).code).toBe("EXACT_SUM_MISMATCH");
      expect((e as SplitError).difference).toBe(7000);
    }
  });
});

describe("validações gerais", () => {
  it("rejeita total zero, negativo ou não inteiro", () => {
    const entries = [{ memberId: "a" }];
    expect(() => computeSplit(0, { method: "EQUAL", entries }, "e")).toThrow();
    expect(() => computeSplit(-100, { method: "EQUAL", entries }, "e")).toThrow();
    expect(() => computeSplit(10.5, { method: "EQUAL", entries }, "e")).toThrow();
  });

  it("rejeita lista vazia e pessoa repetida", () => {
    expect(() => computeSplit(100, { method: "EQUAL", entries: [] }, "e")).toThrow(/pelo menos uma/);
    expect(() => computeSplit(100, { method: "EQUAL", entries: [{ memberId: "a" }, { memberId: "a" }] }, "e")).toThrow(/repetida/);
  });
});

describe("pagadores", () => {
  it("cenário 6 — múltiplos pagadores precisam somar o total", () => {
    expect(validatePayers(24000, [{ memberId: "joao", amountMinor: 18000 }, { memberId: "maria", amountMinor: 6000 }])).toHaveLength(2);
    expect(() => validatePayers(24000, [{ memberId: "joao", amountMinor: 18000 }])).toThrow(PayerError);
  });

  it("rejeita pagador com valor zero ou repetido", () => {
    expect(() => validatePayers(100, [{ memberId: "a", amountMinor: 100 }, { memberId: "b", amountMinor: 0 }])).toThrow(/maior que zero/);
    expect(() => validatePayers(100, [{ memberId: "a", amountMinor: 50 }, { memberId: "a", amountMinor: 50 }])).toThrow(/repetido/);
  });
});

describe("propriedades (entradas aleatórias)", () => {
  const ids = fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 15 });
  const total = fc.integer({ min: 1, max: 1_000_000_000 });

  it("igualitária: soma exata, ninguém negativo, diferença máxima de 1 centavo", () => {
    fc.assert(
      fc.property(total, ids, fc.string(), (t, members, seed) => {
        const r = computeSplit(t, { method: "EQUAL", entries: members.map((memberId) => ({ memberId })) }, seed);
        const values = r.map((s) => s.amountMinor);
        expect(values.reduce((a, b) => a + b, 0)).toBe(t);
        expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("por partes: soma exata e cada valor a menos de 1 centavo do proporcional exato", () => {
    fc.assert(
      fc.property(
        total,
        ids.chain((members) =>
          fc.tuple(fc.constant(members), fc.array(fc.integer({ min: 0, max: 100_000 }), { minLength: members.length, maxLength: members.length })),
        ),
        (t, [members, weights]) => {
          fc.pre(weights.some((w) => w > 0));
          const r = computeSplit(t, { method: "SHARES", entries: members.map((memberId, i) => ({ memberId, value: weights[i]! })) }, "s");
          expect(r.reduce((a, s) => a + s.amountMinor, 0)).toBe(t);
          const sumW = weights.reduce((a, b) => a + b, 0);
          r.forEach((s, i) => {
            // |valor × Σpesos − total × peso| < Σpesos  ⇔  erro < 1 centavo (aritmética inteira exata)
            const diff = BigInt(s.amountMinor) * BigInt(sumW) - BigInt(t) * BigInt(weights[i]!);
            expect(diff < BigInt(sumW) && diff > -BigInt(sumW)).toBe(true);
          });
        },
      ),
    );
  });

  it("apportion nunca cria nem perde centavos", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 20 }), (t, ws) => {
        const result = apportion(t, ws.map((weight, i) => ({ memberId: `m${i}`, weight })), "seed");
        expect([...result.values()].reduce((a, b) => a + b, 0)).toBe(t);
      }),
    );
  });
});
