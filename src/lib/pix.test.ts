import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16, sanitizePixText } from "./pix";

describe("Pix Copia e Cola (BR Code)", () => {
  it("reproduz o exemplo do manual do Banco Central", () => {
    const payload = buildPixPayload({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Fulano de Tal", city: "BRASILIA" });
    expect(payload).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    );
  });

  it("inclui o valor com duas casas e o CRC confere", () => {
    const payload = buildPixPayload({ key: "+5511912345678", name: "Ana", amountMinor: 3334 });
    expect(payload).toContain("540533.34");
    const body = payload.slice(0, -4);
    expect(payload.slice(-4)).toBe(crc16(body));
  });

  it("remove acentos e limita nome e cidade", () => {
    expect(sanitizePixText("João da Conceição Ávila Pereira Sobrinho", 25)).toBe("Joao da Conceicao Avila P");
    const payload = buildPixPayload({ key: "a@b.co", name: "Ção", city: "São Paulo" });
    expect(payload).toContain("5903Cao");
    expect(payload).toContain("6009Sao Paulo");
  });

  it("aceita descrição e respeita o limite de 99 caracteres do campo 26", () => {
    const payload = buildPixPayload({ key: "a@b.co", name: "Ana", description: "Meluno - Viagem Ubatuba ".repeat(10) });
    const len = Number(payload.slice(payload.indexOf("26") + 2, payload.indexOf("26") + 4));
    expect(len).toBeLessThanOrEqual(99);
    expect(payload).toContain("br.gov.bcb.pix");
  });
});
