import { parse, type HTMLElement } from "node-html-parser";
import { apportion, MAX_ITEMS } from "./split";

/**
 * NFC-e (nota fiscal do consumidor, modelo 65).
 *
 * O QR Code é um link para a consulta pública da SEFAZ do estado. Quase sempre
 * ele traz só a chave de acesso (44 dígitos); valor e dia só vêm quando a nota
 * foi emitida em contingência (offline). Os itens só existem na página da SEFAZ.
 */

const UF_BY_CODE: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

export class NfceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NfceError";
  }
}

export type NfceKey = {
  chave: string;
  uf: string;
  /** Ano e mês de emissão, vindos da própria chave. */
  year: number;
  month: number;
  cnpj: string;
  serie: number;
  numero: number;
};

/** Valida a chave de acesso (44 dígitos, DV módulo 11, modelo 65) e extrai os campos. */
export function parseChave(raw: string): NfceKey {
  const chave = raw.replace(/\D/g, "");
  if (chave.length !== 44) throw new NfceError("A chave de acesso tem 44 dígitos.");
  const uf = UF_BY_CODE[chave.slice(0, 2)];
  if (!uf) throw new NfceError("Chave de acesso inválida.");
  if (chave.slice(20, 22) !== "65") throw new NfceError("Este QR não é de uma NFC-e (nota do consumidor).");
  if (dvMod11(chave.slice(0, 43)) !== Number(chave[43])) throw new NfceError("Chave de acesso inválida.");
  const month = Number(chave.slice(4, 6));
  if (month < 1 || month > 12) throw new NfceError("Chave de acesso inválida.");
  return {
    chave,
    uf,
    year: 2000 + Number(chave.slice(2, 4)),
    month,
    cnpj: chave.slice(6, 20),
    serie: Number(chave.slice(22, 25)),
    numero: Number(chave.slice(25, 34)),
  };
}

function dvMod11(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export type NfceQr = {
  key: NfceKey;
  /** Endereço da consulta pública (null quando foi digitada só a chave). */
  url: URL | null;
  /** Ambiente 2 = homologação (nota de teste, sem valor fiscal). */
  test: boolean;
  /** Só em notas de contingência (offline). */
  day: number | null;
  totalMinor: number | null;
};

/**
 * Entende o conteúdo do QR: versões 1 (parâmetros), 2 e 3 (`p=chave|versão|ambiente|…`)
 * ou apenas a chave digitada.
 */
export function parseNfceQr(text: string): NfceQr {
  const raw = text.trim();
  if (/^[\d\s.-]{44,60}$/.test(raw)) return { key: parseChave(raw), url: null, test: false, day: null, totalMinor: null };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NfceError("Esse QR Code não é de nota fiscal.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new NfceError("Esse QR Code não é de nota fiscal.");

  const p = url.searchParams.get("p");
  if (p) {
    const parts = p.split("|");
    const key = parseChave(parts[0] ?? "");
    const test = parts[2] === "2";
    // Contingência (offline) nas versões 2 e 3: chave|v|amb|dia|valor|…
    const offline = parts.length >= 8;
    const day = offline ? Number(parts[3]) : null;
    const totalMinor = offline ? decimalToMinor(parts[4] ?? "") : null;
    return { key, url, test, day: day && day >= 1 && day <= 31 ? day : null, totalMinor };
  }

  const chNFe = url.searchParams.get("chNFe");
  if (chNFe) {
    // Versão 1: dhEmi vem em hexadecimal (texto ISO codificado).
    const key = parseChave(chNFe);
    const iso = hexToText(url.searchParams.get("dhEmi") ?? "");
    const day = /^\d{4}-\d{2}-(\d{2})/.exec(iso)?.[1];
    return {
      key,
      url,
      test: url.searchParams.get("tpAmb") === "2",
      day: day ? Number(day) : null,
      totalMinor: decimalToMinor(url.searchParams.get("vNF") ?? ""),
    };
  }
  throw new NfceError("Esse QR Code não é de nota fiscal.");
}

function hexToText(hex: string): string {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2) return "";
  return hex.replace(/../g, (h) => String.fromCharCode(parseInt(h, 16)));
}

/** "21.90" → 2190 (formato do QR). */
function decimalToMinor(v: string): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(v.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** "1.234,56" → 123456 (formato das páginas da SEFAZ). */
export function brlToMinor(v: string): number | null {
  const m = /(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/.exec(v.replace(/\s/g, ""));
  if (!m) return null;
  return Number(m[1]!.replace(/\./g, "")) * 100 + Number(m[2]);
}

export type NfcePageItem = { description: string; quantity: string; unit: string; totalMinor: number };
export type NfcePage = {
  store: string | null;
  issuedOn: string | null; // AAAA-MM-DD
  items: NfcePageItem[];
  itemsTotalMinor: number | null;
  discountMinor: number;
  payableMinor: number | null;
};

const text = (el: HTMLElement | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * Lê a página de consulta no layout padrão do portal da NFC-e (tabela `#tabResult`),
 * usado pela maioria dos estados. Fora desse layout, devolve sem itens.
 */
export function parseNfcePage(html: string): NfcePage {
  const root = parse(html);

  const items: NfcePageItem[] = [];
  for (const row of root.querySelectorAll("#tabResult tr")) {
    const description = text(row.querySelector("span.txtTit, span.txtTit2"));
    const totalMinor = brlToMinor(text(row.querySelector("span.valor")));
    if (!description || totalMinor === null) continue;
    const quantity = text(row.querySelector("span.Rqtd")).replace(/^Qtde\.?:?\s*/i, "");
    const unit = text(row.querySelector("span.RUN")).replace(/^UN:?\s*/i, "");
    items.push({ description, quantity, unit, totalMinor });
  }

  // Totais: cada linha tem um rótulo ("Valor total R$:", "Descontos R$:", "Valor a pagar R$:").
  let itemsTotalMinor: number | null = null;
  let discountMinor = 0;
  let payableMinor: number | null = null;
  for (const line of root.querySelectorAll("#totalNota #linhaTotal, #totalNota .linhaShade, #totalNota > div")) {
    const label = text(line.querySelector("label")).toLowerCase();
    const value = brlToMinor(text(line.querySelector(".totalNumb")));
    if (value === null) continue;
    if (label.includes("desconto")) discountMinor = value;
    else if (label.includes("a pagar")) payableMinor = value;
    else if (label.includes("valor total")) itemsTotalMinor = value;
  }

  const store = text(root.querySelector(".txtTopo")) || null;
  const emission = /Emiss[ãa]o:?\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(text(root.querySelector("body") ?? root));
  const issuedOn = emission ? `${emission[3]}-${emission[2]}-${emission[1]}` : null;

  return { store, issuedOn, items, itemsTotalMinor, discountMinor, payableMinor };
}

export type NfceImport = {
  /** "sefaz": itens lidos da página; "qr": só o que dá para saber pelo QR. */
  source: "sefaz" | "qr";
  chave: string;
  uf: string;
  test: boolean;
  store: string | null;
  /** AAAA-MM-DD, quando o dia é conhecido. */
  date: string | null;
  totalMinor: number | null;
  items: { description: string; amountMinor: number }[];
  /** Desconto da nota já distribuído entre os itens. */
  discountMinor: number;
};

/** "ARROZ  TIO JOAO 5KG" → "Arroz tio joao 5kg" (notas vêm em caixa alta). */
function tidy(description: string): string {
  const lower = description.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

function itemLabel(item: NfcePageItem): string {
  const qty = item.quantity.replace(",", ".");
  const n = Number(qty);
  const prefix = Number.isFinite(n) && n > 0 && n !== 1 ? `${item.quantity.replace(/,(\d*?)0+$/, ",$1").replace(/,$/, "")} ${item.unit.toLowerCase() || "un"} · ` : "";
  return (prefix + tidy(item.description)).slice(0, 80);
}

/**
 * Junta o QR e (se houver) a página: itens prontos para a divisão por item.
 * - desconto da nota é distribuído entre os itens na proporção do valor;
 * - acima de 60 itens, o restante vira "Outros itens".
 */
export function buildImport(qr: NfceQr, page: NfcePage | null): NfceImport {
  const { key } = qr;
  const qrDate = qr.day ? `${key.year}-${String(key.month).padStart(2, "0")}-${String(qr.day).padStart(2, "0")}` : null;
  const base = { chave: key.chave, uf: key.uf, test: qr.test, store: page?.store ? tidy(page.store) : null, date: page?.issuedOn ?? qrDate };

  if (!page || page.items.length === 0) {
    return { ...base, source: "qr", totalMinor: page?.payableMinor ?? qr.totalMinor, items: [], discountMinor: 0 };
  }

  let items = page.items.map((i) => ({ description: itemLabel(i), amountMinor: i.totalMinor }));
  if (items.length > MAX_ITEMS) {
    const rest = items.slice(MAX_ITEMS - 1);
    items = [...items.slice(0, MAX_ITEMS - 1), { description: `Outros itens (${rest.length})`, amountMinor: rest.reduce((s, i) => s + i.amountMinor, 0) }];
  }

  const gross = items.reduce((s, i) => s + i.amountMinor, 0);
  const discountMinor = Math.min(page.discountMinor, gross);
  if (discountMinor > 0) {
    const shares = apportion(
      discountMinor,
      items.map((i, idx) => ({ memberId: String(idx), weight: i.amountMinor })),
      `${key.chave}:desconto`,
    );
    items = items.map((i, idx) => ({ ...i, amountMinor: i.amountMinor - (shares.get(String(idx)) ?? 0) }));
  }
  items = items.filter((i) => i.amountMinor > 0);

  return { ...base, source: "sefaz", totalMinor: items.reduce((s, i) => s + i.amountMinor, 0), items, discountMinor };
}
