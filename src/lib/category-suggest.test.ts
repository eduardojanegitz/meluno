import { describe, expect, it } from "vitest";
import { normalizeDescription, suggestCategory } from "./category-suggest";

describe("sugestão de categoria", () => {
  it("palavras-chave", () => {
    expect(suggestCategory("Uber pro aeroporto")).toBe("TRANSPORT");
    expect(suggestCategory("Jantar")).toBe("FOOD");
    expect(suggestCategory("Presente da Ana")).toBeNull();
  });

  it("o histórico do grupo vence as palavras-chave, ignorando acento, caixa e espaços", () => {
    const history = { "presente da ana": "EVENTS", "uber pro aeroporto": "TRAVEL" } as const;
    expect(suggestCategory("  Presente  da ANA ", history)).toBe("EVENTS");
    expect(suggestCategory("Uber pro aeroporto", history)).toBe("TRAVEL");
    expect(suggestCategory("Uber pro centro", history)).toBe("TRANSPORT");
  });

  it("normaliza", () => {
    expect(normalizeDescription("  Açaí  da Praça ")).toBe("acai da praca");
  });
});
