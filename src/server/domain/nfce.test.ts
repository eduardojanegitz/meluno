import { describe, expect, it } from "vitest";
import { brlToMinor, buildImport, NfceError, parseChave, parseNfcePage, parseNfceQr } from "./nfce";

// cUF 35 (SP), 2026-11, CNPJ 12.345.678/0001-95, modelo 65, série 1, nº 1234.
const CHAVE = "35261112345678000195650010000012341123456784";
const NFE_55 = "31261112345678000195550010000012341123456782";
const SP = "https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx";

describe("chave de acesso", () => {
  it("extrai estado, mês, CNPJ e número", () => {
    expect(parseChave(CHAVE)).toEqual({ chave: CHAVE, uf: "SP", year: 2026, month: 11, cnpj: "12345678000195", serie: 1, numero: 1234 });
  });

  it("aceita a chave com espaços (como vem impressa)", () => {
    expect(parseChave(CHAVE.replace(/(\d{4})/g, "$1 ")).chave).toBe(CHAVE);
  });

  it("recusa dígito verificador errado, NF-e (modelo 55) e tamanho errado", () => {
    expect(() => parseChave(CHAVE.slice(0, 43) + "5")).toThrow(NfceError);
    expect(() => parseChave(NFE_55)).toThrow(/NFC-e/);
    expect(() => parseChave("123")).toThrow(/44/);
  });
});

describe("QR Code", () => {
  it("versão 2 online: só a chave", () => {
    const qr = parseNfceQr(`${SP}?p=${CHAVE}|2|1|1|ABCDEF0123456789`);
    expect(qr).toMatchObject({ test: false, day: null, totalMinor: null });
    expect(qr.key.uf).toBe("SP");
    expect(qr.url?.hostname).toBe("www.nfce.fazenda.sp.gov.br");
  });

  it("versão 2 em contingência: traz dia e valor", () => {
    const qr = parseNfceQr(`${SP}?p=${CHAVE}|2|1|12|35.90|6a4b|1|ABCDEF`);
    expect(qr).toMatchObject({ day: 12, totalMinor: 3590 });
  });

  it("versão 3 online e ambiente de homologação", () => {
    expect(parseNfceQr(`${SP}?p=${CHAVE}|3|2`)).toMatchObject({ test: true, day: null });
  });

  it("versão 1: parâmetros com data em hexadecimal", () => {
    const dhEmi = Buffer.from("2026-11-09T19:20:01-03:00").toString("hex");
    const qr = parseNfceQr(`${SP}?chNFe=${CHAVE}&nVersao=100&tpAmb=1&dhEmi=${dhEmi}&vNF=12.50&vICMS=0.00`);
    expect(qr).toMatchObject({ day: 9, totalMinor: 1250 });
  });

  it("chave digitada, sem link", () => {
    expect(parseNfceQr(CHAVE)).toMatchObject({ url: null, day: null });
  });

  it("recusa QR que não é de nota (Pix, site qualquer, javascript:)", () => {
    expect(() => parseNfceQr("00020126580014br.gov.bcb.pix")).toThrow(NfceError);
    expect(() => parseNfceQr("https://exemplo.com/?q=1")).toThrow(NfceError);
    expect(() => parseNfceQr(`javascript:alert(1)//?p=${CHAVE}|2|1`)).toThrow(NfceError);
  });
});

it("valores no formato brasileiro", () => {
  expect(brlToMinor("1.234,56")).toBe(123456);
  expect(brlToMinor(" 7,99 ")).toBe(799);
  expect(brlToMinor("Vl. Unit.: 0,50")).toBe(50);
  expect(brlToMinor("abc")).toBeNull();
});

// Recorte do layout padrão do portal da NFC-e (tabela #tabResult).
const PAGE = `
<html><body>
<div id="conteudo">
  <div class="txtCenter"><div id="u20" class="txtTopo">SUPERMERCADO BOM PRECO LTDA</div>
  <div class="text">CNPJ: 12.345.678/0001-95</div></div>
  <table id="tabResult">
    <tr id="Item + 1"><td valign="top"><span class="txtTit">ARROZ TIO JOAO 5KG</span><span class="RCod">(Código: 789)</span><br/>
      <span class="Rqtd"><strong>Qtde.:</strong>1</span><span class="RUN"><strong>UN: </strong>UN</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;29,90</span></td>
      <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br/><span class="valor">29,90</span></td></tr>
    <tr id="Item + 2"><td valign="top"><span class="txtTit">CERVEJA  LATA 350ML</span><br/>
      <span class="Rqtd"><strong>Qtde.:</strong>12</span><span class="RUN"><strong>UN: </strong>UN</span></td>
      <td align="right" class="txtTit noWrap">Vl. Total<br/><span class="valor">59,88</span></td></tr>
    <tr id="Item + 3"><td valign="top"><span class="txtTit">BANANA PRATA</span><br/>
      <span class="Rqtd"><strong>Qtde.:</strong>1,500</span><span class="RUN"><strong>UN: </strong>KG</span></td>
      <td align="right" class="txtTit noWrap">Vl. Total<br/><span class="valor">10,22</span></td></tr>
  </table>
  <div id="totalNota" class="txtRight">
    <div id="linhaTotal"><label>Qtd. total de itens:</label><span class="totalNumb">3</span></div>
    <div id="linhaTotal"><label>Valor total R$:</label><span class="totalNumb">100,00</span></div>
    <div id="linhaTotal"><label>Descontos R$:</label><span class="totalNumb">10,00</span></div>
    <div id="linhaTotal" class="linhaShade"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">90,00</span></div>
  </div>
</div>
<div id="infos"><ul><li><strong>Número: </strong>1234 <strong>Série: </strong>1 <strong>Emissão: </strong>09/11/2026 19:20:01 - Via Consumidor</li></ul></div>
</body></html>`;

describe("página da SEFAZ", () => {
  it("lê loja, data, itens e totais", () => {
    const page = parseNfcePage(PAGE);
    expect(page).toMatchObject({ store: "SUPERMERCADO BOM PRECO LTDA", issuedOn: "2026-11-09", itemsTotalMinor: 10000, discountMinor: 1000, payableMinor: 9000 });
    expect(page.items.map((i) => [i.description, i.quantity, i.unit, i.totalMinor])).toEqual([
      ["ARROZ TIO JOAO 5KG", "1", "UN", 2990],
      ["CERVEJA LATA 350ML", "12", "UN", 5988],
      ["BANANA PRATA", "1,500", "KG", 1022],
    ]);
  });

  it("layout desconhecido: sem itens, sem erro", () => {
    expect(parseNfcePage("<html><body><h1>Consulta indisponível</h1></body></html>").items).toEqual([]);
  });
});

describe("importação para a despesa", () => {
  const qr = parseNfceQr(`${SP}?p=${CHAVE}|2|1|1|ABC`);

  it("itens com nome arrumado, quantidade e desconto distribuído; soma = valor pago", () => {
    const result = buildImport(qr, parseNfcePage(PAGE));
    expect(result.source).toBe("sefaz");
    expect(result.store).toBe("Supermercado bom preco ltda");
    expect(result.date).toBe("2026-11-09");
    expect(result.items.map((i) => i.description)).toEqual(["Arroz tio joao 5kg", "12 un · Cerveja lata 350ml", "1,5 kg · Banana prata"]);
    expect(result.discountMinor).toBe(1000);
    expect(result.totalMinor).toBe(9000);
    expect(result.items.reduce((s, i) => s + i.amountMinor, 0)).toBe(9000);
    // Desconto de 10% proporcional: 29,90 → 26,91 (±1 centavo do arredondamento).
    expect(Math.abs(result.items[0]!.amountMinor - 2691)).toBeLessThanOrEqual(1);
  });

  it("mais de 60 itens: o excedente vira 'Outros itens'", () => {
    const page = { ...parseNfcePage(PAGE), discountMinor: 0 };
    page.items = Array.from({ length: 75 }, (_, i) => ({ description: `ITEM ${i}`, quantity: "1", unit: "UN", totalMinor: 100 }));
    const result = buildImport(qr, page);
    expect(result.items).toHaveLength(60);
    expect(result.items.at(-1)).toEqual({ description: "Outros itens (16)", amountMinor: 1600 });
    expect(result.totalMinor).toBe(7500);
  });

  it("sem página (SEFAZ fora do ar): só dados do QR", () => {
    const offline = parseNfceQr(`${SP}?p=${CHAVE}|2|1|12|35.90|6a4b|1|ABC`);
    expect(buildImport(offline, null)).toMatchObject({ source: "qr", items: [], totalMinor: 3590, date: "2026-11-12", uf: "SP" });
    expect(buildImport(qr, null)).toMatchObject({ source: "qr", totalMinor: null, date: null });
  });
});
