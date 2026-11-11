import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/grupos/abc?aba=saldos")).toBe("/grupos/abc?aba=saldos");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "grupos", "", null, undefined])(
    "bloqueia redirecionamento externo ou inválido: %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/inicio");
    },
  );
});
