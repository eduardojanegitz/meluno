import { formatMoney } from "./format";

/**
 * Próximo valor (em centavos) de um campo monetário "estilo app bancário"
 * após o navegador alterar o texto para `raw`.
 *
 * Independe da posição do cursor: descobre quais dígitos entraram ou saíram
 * comparando com o texto anterior e aplica a mudança SEMPRE no final
 * (digitar acrescenta à direita; apagar remove o último dígito). Se o texto
 * novo não tem formatação (tudo selecionado e substituído/colado), ele vira o valor.
 */
export function nextMoneyValue(value: number, raw: string, currency: string, max: number): number {
  const maxDigits = String(max).length;
  const before = formatMoney(value, { currency }).replace(/\D/g, "");
  const after = raw.replace(/\D/g, "");
  let digits: string;

  if (raw.trim() === "" || !/\D/.test(raw.trim())) {
    digits = after;
  } else {
    let p = 0;
    while (p < before.length && p < after.length && before[p] === after[p]) p++;
    let s = 0;
    while (s < before.length - p && s < after.length - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++;
    const inserted = after.slice(p, after.length - s);
    const removed = before.length - p - s;
    const current = value === 0 ? "" : String(value);
    digits = current.slice(0, Math.max(0, current.length - removed)) + inserted;
  }

  digits = digits.replace(/^0+/, "").slice(0, maxDigits);
  return Math.min(digits === "" ? 0 : Number.parseInt(digits, 10), max);
}
