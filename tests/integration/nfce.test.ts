import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => (host === "interno.sefaz.gov.br" ? [{ address: "10.0.0.5", family: 4 }] : [{ address: "200.144.10.20", family: 4 }])),
}));

const { readNfce, isPrivateAddress } = await import("@/server/services/nfce");
const { AppError } = await import("@/server/errors");

const viewer = { userId: "u1", name: "Ana", email: "ana@example.test" };
const CHAVE = "35261112345678000195650010000012341123456784";
const qrFor = (host: string) => `https://${host}/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${CHAVE}|2|1|1|ABC`;

// Página em ISO-8859-1, como várias SEFAZ ainda servem.
const PAGE = `<html><head><meta charset="iso-8859-1"></head><body>
<div class="txtTopo">PADARIA SÃO JOÃO</div>
<table id="tabResult">
<tr><td><span class="txtTit">PÃO FRANCÊS</span><span class="Rqtd">Qtde.:10</span><span class="RUN">UN: UN</span></td><td><span class="valor">8,00</span></td></tr>
<tr><td><span class="txtTit">CAFÉ</span><span class="Rqtd">Qtde.:1</span><span class="RUN">UN: UN</span></td><td><span class="valor">5,50</span></td></tr>
</table>
<div id="totalNota"><div id="linhaTotal"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">13,50</span></div></div>
<ul><li>Emissão: 10/11/2026 08:01:00</li></ul>
</body></html>`;

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const fetchMock = vi.fn();

describe("leitura de NFC-e (serviço)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(latin1(PAGE), { status: 200, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("busca a página da SEFAZ e devolve os itens (acentos em ISO-8859-1)", async () => {
    const r = await readNfce(viewer, { qr: qrFor("www.nfce.fazenda.sp.gov.br") });
    expect(r).toMatchObject({ source: "sefaz", store: "Padaria são joão", date: "2026-11-10", totalMinor: 1350 });
    expect(r.items).toEqual([
      { description: "10 un · Pão francês", amountMinor: 800 },
      { description: "Café", amountMinor: 550 },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("host fora do governo: não busca nada, fica só com o QR", async () => {
    const r = await readNfce(viewer, { qr: qrFor("sefaz.golpe.com") });
    expect(r).toMatchObject({ source: "qr", items: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DNS apontando para rede interna: não busca", async () => {
    const r = await readNfce(viewer, { qr: qrFor("interno.sefaz.gov.br") });
    expect(r.source).toBe("qr");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("IP direto e porta fora do padrão: não busca", async () => {
    await readNfce(viewer, { qr: `https://127.0.0.1/x?p=${CHAVE}|2|1` });
    await readNfce(viewer, { qr: `https://www.nfce.fazenda.sp.gov.br:8443/x?p=${CHAVE}|2|1` });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirecionamento para fora do governo é bloqueado", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    const r = await readNfce(viewer, { qr: qrFor("www.nfce.fazenda.sp.gov.br") });
    expect(r.source).toBe("qr");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("SEFAZ fora do ar: devolve o que o QR informa, sem erro", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("erro", { status: 503 }));
    const r = await readNfce(viewer, { qr: qrFor("www.nfce.fazenda.sp.gov.br") });
    expect(r).toMatchObject({ source: "qr", uf: "SP", chave: CHAVE });
  });

  it("resposta grande demais é descartada", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(new Uint8Array(3 * 1024 * 1024), { status: 200 }));
    expect((await readNfce(viewer, { qr: qrFor("www.nfce.fazenda.sp.gov.br") })).source).toBe("qr");
  });

  it("QR que não é de nota vira erro de validação", async () => {
    await expect(readNfce(viewer, { qr: "00020126580014br.gov.bcb.pix0136123e4567" })).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "VALIDATION");
  });

  it("classifica endereços internos", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["200.144.10.20", "8.8.8.8", "2804:14c::1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});
