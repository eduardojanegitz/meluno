import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";
import { nextMoneyValue } from "./money-entry";

const MAX = 1_000_000_000;
const typeAt = (value: number, pos: "start" | "end", ch: string) => {
  const f = formatMoney(value);
  return nextMoneyValue(value, pos === "start" ? ch + f : f + ch, "BRL", MAX);
};

describe("nextMoneyValue — digitação independente do cursor", () => {
  it("digitar 1,0,0,0,0 com o cursor no início ou no fim dá R$ 100,00", () => {
    for (const pos of ["start", "end"] as const) {
      let v = 0;
      for (const ch of "10000") v = typeAt(v, pos, ch);
      expect(v).toBe(10000);
    }
  });

  it("backspace remove o último dígito", () => {
    expect(nextMoneyValue(12345, formatMoney(12345).slice(0, -1), "BRL", MAX)).toBe(1234);
    expect(nextMoneyValue(5, formatMoney(5).slice(0, -1), "BRL", MAX)).toBe(0);
  });

  it("colar ou substituir tudo por dígitos define o valor", () => {
    expect(nextMoneyValue(999, "15000", "BRL", MAX)).toBe(15000);
    expect(nextMoneyValue(999, "", "BRL", MAX)).toBe(0);
  });

  it("respeita o teto", () => {
    expect(nextMoneyValue(999_999_999, formatMoney(999_999_999) + "9", "BRL", MAX)).toBe(MAX);
  });
});
