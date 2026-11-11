/**
 * CSV no formato que o Excel em português abre sem configurar nada:
 * separador ";", vírgula decimal, UTF-8 com BOM e quebra de linha CRLF.
 */
export type Cell = string | number | { raw: string } | null | undefined;

/** Texto que começa com = + - @ (ou tab/CR) vira fórmula em planilhas: prefixamos com '. */
function escapeText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Centavos → "1234,56" (número de verdade na planilha, sem separador de milhar). */
export function minorToCell(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

export function toCsv(rows: Cell[][]): string {
  const cell = (c: Cell) => (c === null || c === undefined ? "" : typeof c === "number" ? String(c) : typeof c === "object" ? c.raw : escapeText(c));
  const lines = rows.map((row) => row.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Marca um valor já formatado (ex.: minorToCell) para não ser escapado como texto. */
export const raw = (value: string) => ({ raw: value });
