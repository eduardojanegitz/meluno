import { describe, expect, it } from "vitest";
import { formatMoney, formatRelativeDay, initials, minorToDecimalString } from "./format";

// Intl usa espaço não separável entre "R$" e o número.
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("minorToDecimalString", () => {
  it("converte centavos em decimal exato sem ponto flutuante", () => {
    expect(minorToDecimalString(15000)).toBe("150.00");
    expect(minorToDecimalString(1)).toBe("0.01");
    expect(minorToDecimalString(0)).toBe("0.00");
    expect(minorToDecimalString(-4550)).toBe("-45.50");
    expect(minorToDecimalString(1_000_000_000)).toBe("10000000.00");
  });

  it("respeita moedas sem casas decimais", () => {
    expect(minorToDecimalString(1500, "JPY")).toBe("1500");
  });

  it("rejeita valores não inteiros", () => {
    expect(() => minorToDecimalString(10.5)).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  it("formata em reais no padrão brasileiro", () => {
    expect(nbsp(formatMoney(15000))).toBe("R$ 150,00");
    expect(nbsp(formatMoney(123456789))).toBe("R$ 1.234.567,89");
    expect(nbsp(formatMoney(-2000))).toBe("-R$ 20,00");
  });

  it("não sofre erro de arredondamento binário (0,1 + 0,2)", () => {
    expect(nbsp(formatMoney(10 + 20))).toBe("R$ 0,30");
  });

  it("mostra sinal explícito quando pedido", () => {
    expect(nbsp(formatMoney(10000, { signDisplay: "exceptZero" }))).toBe("+R$ 100,00");
    expect(nbsp(formatMoney(0, { signDisplay: "exceptZero" }))).toBe("R$ 0,00");
  });
});

describe("formatRelativeDay", () => {
  const now = new Date(2026, 10, 10, 15);
  it("usa termos relativos para a última semana", () => {
    expect(formatRelativeDay(new Date(2026, 10, 10, 8), now)).toBe("hoje");
    expect(formatRelativeDay(new Date(2026, 10, 9, 23), now)).toBe("ontem");
    expect(formatRelativeDay(new Date(2026, 10, 7), now)).toBe("há 3 dias");
  });
  it("usa data curta para datas mais antigas", () => {
    expect(formatRelativeDay(new Date(2026, 9, 12), now)).toBe("12 de out.");
    expect(formatRelativeDay(new Date(2025, 9, 12), now)).toBe("12 de out. de 2025");
  });
});

describe("initials", () => {
  it("usa primeira e última palavra", () => {
    expect(initials("Maria Clara Souza")).toBe("MS");
    expect(initials("  joão ")).toBe("J");
    expect(initials("")).toBe("?");
  });
});
