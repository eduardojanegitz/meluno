import { describe, expect, it } from "vitest";
import { minorToCell, raw, toCsv } from "./csv";

describe("CSV para planilhas", () => {
  it("BOM, ponto e vírgula e CRLF", () => {
    expect(toCsv([["a", "b"], [1, null]])).toBe("﻿a;b\r\n1;\r\n");
  });

  it("aspas em texto com ; aspas ou quebra de linha", () => {
    expect(toCsv([['Pizza; "grande"', "linha\nnova"]])).toBe('﻿"Pizza; ""grande"""' + ";" + '"linha\nnova"\r\n');
  });

  it("protege contra fórmulas (CSV injection)", () => {
    expect(toCsv([["=HYPERLINK(\"x\")", "+1", "-2", "@soma", "normal"]])).toBe("﻿\"'=HYPERLINK(\"\"x\"\")\";'+1;'-2;'@soma;normal\r\n");
  });

  it("valores com vírgula decimal; negativos marcados como número não são escapados", () => {
    expect(minorToCell(123456)).toBe("1234,56");
    expect(minorToCell(-5)).toBe("-0,05");
    expect(toCsv([[raw(minorToCell(-4500))]])).toBe("﻿-45,00\r\n");
  });
});
