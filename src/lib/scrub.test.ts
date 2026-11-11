import { describe, expect, it } from "vitest";
import { routeOf, scrub } from "./scrub";

describe("limpeza de dados pessoais em erros", () => {
  it("tira e-mail, ids, tokens e números", () => {
    const msg = 'Unique constraint on ana.silva@gmail.com for 0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b, CPF 123.456.789-09, tel (11) 91234-5678, token abcdEFGH1234abcdEFGH1234abcdEFGH12';
    const out = scrub(msg);
    expect(out).not.toMatch(/ana\.silva|0193a1b2|123\.456|91234|abcdEFGH/);
    expect(out).toContain("[email]");
    expect(out).toContain("[id]");
  });

  it("caminho sem query e sem ids", () => {
    expect(routeOf("/grupos/0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/despesas/0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c?aba=saldos")).toBe("/grupos/:id/despesas/:id");
    expect(routeOf("/convites/vJIiG2NH22zXp1u-XTQ")).toBe("/convites/:token");
  });
});
