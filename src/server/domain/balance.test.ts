import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { computeBalances, pairwiseDebts, type Ledger } from "./balance";
import { greedy, simplifyDebts, EXACT_LIMIT } from "./simplify";
import { computeSplit } from "./split";

const obj = (m: Map<string, number>) => Object.fromEntries(m);

/** Aplica transferências sobre saldos: o resultado deve ser tudo zero. */
function applyTransfers(balances: Map<string, number>, debts: { fromMemberId: string; toMemberId: string; amountMinor: number }[]) {
  const out = new Map(balances);
  for (const d of debts) {
    out.set(d.fromMemberId, (out.get(d.fromMemberId) ?? 0) + d.amountMinor);
    out.set(d.toMemberId, (out.get(d.toMemberId) ?? 0) - d.amountMinor);
  }
  return out;
}

describe("saldos", () => {
  // Exemplo do briefing: João pagou 180, Maria 60, Pedro 0; os três participaram igualmente.
  const ledger: Ledger = {
    expenses: [
      {
        id: "e1",
        payers: [
          { memberId: "joao", amountMinor: 18000 },
          { memberId: "maria", amountMinor: 6000 },
        ],
        splits: computeSplit(24000, { method: "EQUAL", entries: [{ memberId: "joao" }, { memberId: "maria" }, { memberId: "pedro" }] }, "e1"),
      },
    ],
    settlements: [],
  };

  it("cenário 6 — múltiplos pagadores: João +100, Maria −20, Pedro −80", () => {
    expect(obj(computeBalances(ledger))).toEqual({ joao: 10000, maria: -2000, pedro: -8000 });
  });

  it("acerto simplificado: Maria paga 20 e Pedro paga 80 para João", () => {
    expect(simplifyDebts(computeBalances(ledger))).toEqual([
      { fromMemberId: "pedro", toMemberId: "joao", amountMinor: 8000 },
      { fromMemberId: "maria", toMemberId: "joao", amountMinor: 2000 },
    ]);
  });

  it("cenário 7 — quem não participou não deve nada; quem pagou sem consumir recebe tudo", () => {
    const l: Ledger = {
      expenses: [
        {
          id: "e2",
          payers: [{ memberId: "ana", amountMinor: 9000 }],
          splits: computeSplit(9000, { method: "EQUAL", entries: [{ memberId: "bia" }, { memberId: "caio" }] }, "e2"),
        },
      ],
      settlements: [],
    };
    expect(obj(computeBalances(l, ["ana", "bia", "caio", "davi"]))).toEqual({ ana: 9000, bia: -4500, caio: -4500, davi: 0 });
  });

  it("cenário 8 — pagamento parcial: deve 100, paga 40, restam 60", () => {
    const l: Ledger = {
      expenses: [{ id: "e", payers: [{ memberId: "joao", amountMinor: 20000 }], splits: [{ memberId: "joao", amountMinor: 10000 }, { memberId: "maria", amountMinor: 10000 }] }],
      settlements: [{ fromMemberId: "maria", toMemberId: "joao", amountMinor: 4000 }],
    };
    expect(obj(computeBalances(l))).toEqual({ joao: 6000, maria: -6000 });
    expect(simplifyDebts(computeBalances(l))).toEqual([{ fromMemberId: "maria", toMemberId: "joao", amountMinor: 6000 }]);
  });

  it("cenário 9 — pagamento integral zera os saldos", () => {
    const l: Ledger = {
      expenses: [{ id: "e", payers: [{ memberId: "joao", amountMinor: 9000 }], splits: [{ memberId: "joao", amountMinor: 4500 }, { memberId: "maria", amountMinor: 4500 }] }],
      settlements: [{ fromMemberId: "maria", toMemberId: "joao", amountMinor: 4500 }],
    };
    expect(obj(computeBalances(l))).toEqual({ joao: 0, maria: 0 });
    expect(simplifyDebts(computeBalances(l))).toEqual([]);
  });

  it("pagamento acima do devido inverte o sentido da dívida", () => {
    const l: Ledger = {
      expenses: [{ id: "e", payers: [{ memberId: "a", amountMinor: 1000 }], splits: [{ memberId: "a", amountMinor: 500 }, { memberId: "b", amountMinor: 500 }] }],
      settlements: [{ fromMemberId: "b", toMemberId: "a", amountMinor: 700 }],
    };
    expect(obj(computeBalances(l))).toEqual({ a: -200, b: 200 });
  });
});

describe("dívidas por par (sem simplificação)", () => {
  it("rateia a parte de cada participante entre múltiplos pagadores", () => {
    const l: Ledger = {
      expenses: [
        {
          id: "e1",
          payers: [
            { memberId: "joao", amountMinor: 18000 },
            { memberId: "maria", amountMinor: 6000 },
          ],
          splits: [
            { memberId: "joao", amountMinor: 8000 },
            { memberId: "maria", amountMinor: 8000 },
            { memberId: "pedro", amountMinor: 8000 },
          ],
        },
      ],
      settlements: [],
    };
    // Pedro deve 80 = 60 para João (3/4) + 20 para Maria (1/4); Maria deve 60 a João e João deve 20 a Maria → Maria deve 40 a João.
    expect(pairwiseDebts(l)).toEqual([
      { fromMemberId: "pedro", toMemberId: "joao", amountMinor: 6000 },
      { fromMemberId: "maria", toMemberId: "joao", amountMinor: 4000 },
      { fromMemberId: "pedro", toMemberId: "maria", amountMinor: 2000 },
    ]);
  });

  it("um ciclo A→B→C→A se compensa por pares, mas a simplificação elimina o ciclo", () => {
    const l: Ledger = {
      expenses: [
        { id: "1", payers: [{ memberId: "a", amountMinor: 1000 }], splits: [{ memberId: "b", amountMinor: 1000 }] },
        { id: "2", payers: [{ memberId: "b", amountMinor: 1000 }], splits: [{ memberId: "c", amountMinor: 1000 }] },
        { id: "3", payers: [{ memberId: "c", amountMinor: 1000 }], splits: [{ memberId: "a", amountMinor: 1000 }] },
      ],
      settlements: [],
    };
    expect(pairwiseDebts(l)).toHaveLength(3);
    expect(simplifyDebts(computeBalances(l))).toEqual([]);
  });
});

describe("simplificação de dívidas", () => {
  it("cenário 12 — encontra o mínimo onde o guloso não encontra", () => {
    // Ótimo: {+1, +4, −5} e {+6, −3, −3} → 2 + 2 = 4 transferências. O guloso gera 5.
    const balances = new Map([
      ["a", 100],
      ["b", -300],
      ["c", 600],
      ["d", 400],
      ["e", -500],
      ["f", -300],
    ]);
    const asEntries = [...balances].map(([memberId, amount]) => ({ memberId, amount }));
    expect(greedy(asEntries)).toHaveLength(5);
    const debts = simplifyDebts(balances);
    expect(debts).toHaveLength(4);
    expect(obj(applyTransfers(balances, debts))).toEqual({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 });
  });

  it("rejeita saldos que não somam zero", () => {
    expect(() => simplifyDebts(new Map([["a", 100]]))).toThrow(/inconsistentes/);
  });

  const balancesArb = (maxSize: number) =>
    fc.array(fc.integer({ min: -1_000_000, max: 1_000_000 }), { minLength: 1, maxLength: maxSize - 1 }).map((values) => {
      const m = new Map<string, number>();
      values.forEach((v, i) => m.set(`m${String(i).padStart(2, "0")}`, v));
      m.set("zz", 0 - values.reduce((a, b) => a + b, 0)); // fecha em zero (0 - x evita o -0 quando a soma é 0)
      return m;
    });

  for (const [label, size] of [
    ["exato", EXACT_LIMIT],
    ["guloso", 40],
  ] as const) {
    it(`propriedades (${label}): zera saldos, sem transferências inválidas, no máximo n−1`, () => {
      fc.assert(
        fc.property(balancesArb(size), (balances) => {
          const debts = simplifyDebts(balances);
          for (const v of applyTransfers(balances, debts).values()) expect(v).toBe(0);
          for (const d of debts) {
            expect(d.amountMinor).toBeGreaterThan(0);
            expect(Number.isSafeInteger(d.amountMinor)).toBe(true);
            expect(d.fromMemberId).not.toBe(d.toMemberId);
          }
          const nonZero = [...balances.values()].filter((v) => v !== 0).length;
          expect(debts.length).toBeLessThanOrEqual(Math.max(nonZero - 1, 0));
        }),
        { numRuns: label === "exato" ? 200 : 300 },
      );
    });
  }

  it("determinismo: a ordem de entrada não altera o resultado", () => {
    fc.assert(
      fc.property(balancesArb(10), (balances) => {
        const reversed = new Map([...balances].reverse());
        expect(simplifyDebts(reversed)).toEqual(simplifyDebts(balances));
      }),
    );
  });

  it("pares de dívidas por par também preservam os saldos líquidos", () => {
    const ledgerArb = fc.array(
      fc.record({
        total: fc.integer({ min: 1, max: 100_000 }),
        payer: fc.constantFrom("a", "b", "c", "d"),
        parts: fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), { minLength: 1, maxLength: 4 }),
      }),
      { minLength: 1, maxLength: 12 },
    );
    fc.assert(
      fc.property(ledgerArb, (items) => {
        const ledger: Ledger = {
          expenses: items.map((it, i) => ({
            id: `e${i}`,
            payers: [{ memberId: it.payer, amountMinor: it.total }],
            splits: computeSplit(it.total, { method: "EQUAL", entries: it.parts.map((memberId) => ({ memberId })) }, `e${i}`),
          })),
          settlements: [],
        };
        const balances = computeBalances(ledger);
        const after = applyTransfers(balances, pairwiseDebts(ledger));
        for (const v of after.values()) expect(v).toBe(0);
      }),
    );
  });
});
