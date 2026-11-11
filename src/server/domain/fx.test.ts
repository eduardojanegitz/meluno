import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { convertMinor, formatRate, FxError, parseRate, rateFromNumber } from "./fx";

describe("conversão de moeda", () => {
  it("lê e escreve cotações sem perder casas", () => {
    expect(parseRate("5,5517")).toBe(55_517_000_000n);
    expect(parseRate("5.5517")).toBe(55_517_000_000n);
    expect(formatRate(parseRate("0,0379"))).toBe("0,0379");
    expect(formatRate(parseRate("7"))).toBe("7");
    expect(formatRate(rateFromNumber(5.5517))).toBe("5,5517");
  });

  it("recusa cotação vazia, zero, negativa, com letras ou casas demais", () => {
    for (const bad of ["", "0", "0,0000", "-5", "abc", "5,12345678901", "99999999"]) expect(() => parseRate(bad), bad).toThrow(FxError);
  });

  it("converte arredondando meio para cima, respeitando as casas de cada moeda", () => {
    expect(convertMinor(5000, "USD", "BRL", parseRate("5,5517"))).toBe(27759); // 277,585 → 277,59
    expect(convertMinor(10000, "JPY", "BRL", parseRate("0,0379"))).toBe(37900); // ¥10.000 → R$ 379,00 (JPY sem centavos)
    expect(convertMinor(2550, "EUR", "JPY", parseRate("162,3"))).toBe(4139); // €25,50 → ¥4.139 (4138,65)
    expect(convertMinor(1, "USD", "BRL", parseRate("1"))).toBe(1);
    expect(() => convertMinor(1, "BRL", "PYG", parseRate("0,00000001"))).toThrow(/zero/);
  });

  it("propriedade: o convertido fica a no máximo 1 centavo do valor exato", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 10_000_000 }), fc.integer({ min: 1, max: 99_999 }), (minor, r) => {
        const rate = parseRate(`${Math.floor(r / 10000)},${String(r % 10000).padStart(4, "0")}`);
        const exact = (BigInt(minor) * rate) / 10n ** 10n;
        // Menos de meio centavo: a conversão recusa (ver teste acima).
        if ((BigInt(minor) * rate * 2n) / 10n ** 10n < 1n) {
          expect(() => convertMinor(minor, "USD", "BRL", rate)).toThrow(/zero/);
          return;
        }
        const brl = convertMinor(minor, "USD", "BRL", rate);
        expect(Math.abs(brl - Number(exact))).toBeLessThanOrEqual(1);
      }),
      { numRuns: 300 },
    );
  });
});
