import { describe, expect, it } from "vitest";
import { firstOccurrenceAfter, nextOccurrence, todayInBrazil } from "./recurrence";

describe("recorrência", () => {
  it("mensal: mesmo dia; 31 cai no último dia de meses curtos e volta ao 31", () => {
    expect(nextOccurrence("2026-01-31", "MONTHLY", 31)).toBe("2026-02-28");
    expect(nextOccurrence("2026-02-28", "MONTHLY", 31)).toBe("2026-03-31");
    expect(nextOccurrence("2028-01-30", "MONTHLY", 30)).toBe("2028-02-29"); // bissexto
    expect(nextOccurrence("2026-12-05", "MONTHLY", 5)).toBe("2027-01-05");
  });

  it("semanal: +7 dias, virando mês e ano", () => {
    expect(nextOccurrence("2026-12-28", "WEEKLY", 28)).toBe("2027-01-04");
  });

  it("retomar pula as ocorrências perdidas", () => {
    expect(firstOccurrenceAfter("2026-08-10", "2026-11-11", "MONTHLY", 10)).toBe("2026-12-10");
    expect(firstOccurrenceAfter("2026-11-20", "2026-11-11", "MONTHLY", 20)).toBe("2026-11-20");
  });

  it("hoje no fuso de Brasília", () => {
    expect(todayInBrazil(new Date("2026-11-12T02:30:00Z"))).toBe("2026-11-11"); // 23h30 em SP
    expect(todayInBrazil(new Date("2026-11-12T03:30:00Z"))).toBe("2026-11-12");
  });
});
