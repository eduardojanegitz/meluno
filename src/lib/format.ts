/**
 * Formatação de apresentação. Valores monetários chegam sempre como
 * inteiros em unidades mínimas (centavos) — nunca como float.
 */

export const DEFAULT_LOCALE = "pt-BR";
export const DEFAULT_CURRENCY = "BRL";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string, locale: string, signDisplay: Intl.NumberFormatOptions["signDisplay"]) {
  const key = `${locale}|${currency}|${signDisplay}`;
  let fmt = moneyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: "currency", currency, signDisplay });
    moneyFormatters.set(key, fmt);
  }
  return fmt;
}

/** Casas decimais da moeda (BRL = 2, JPY = 0). */
export function currencyFractionDigits(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
}

/**
 * Converte unidades mínimas para string decimal exata ("15000" → "150.00")
 * sem passar por ponto flutuante.
 */
export function minorToDecimalString(amountMinor: number, currency = DEFAULT_CURRENCY): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`amountMinor precisa ser inteiro seguro: ${amountMinor}`);
  }
  const digits = currencyFractionDigits(currency);
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor).toString().padStart(digits + 1, "0");
  const whole = digits === 0 ? abs : abs.slice(0, -digits);
  const frac = digits === 0 ? "" : `.${abs.slice(-digits)}`;
  return `${negative ? "-" : ""}${whole}${frac}`;
}

export type MoneyFormatOptions = {
  currency?: string;
  locale?: string;
  /** "always" mostra "+R$ 10,00" para positivos. */
  signDisplay?: Intl.NumberFormatOptions["signDisplay"];
};

export function formatMoney(
  amountMinor: number,
  { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, signDisplay = "auto" }: MoneyFormatOptions = {},
): string {
  // Intl aceita string decimal exata, evitando qualquer arredondamento binário.
  const decimal = minorToDecimalString(amountMinor, currency) as `${number}`;
  return moneyFormatter(currency, locale, signDisplay).format(decimal);
}

const relativeFormatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: "auto" });
const shortDate = new Intl.DateTimeFormat(DEFAULT_LOCALE, { day: "numeric", month: "short" });
const shortDateYear = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "hoje", "ontem", "há 3 dias", "12 de out." */
export function formatRelativeDay(date: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(date) - startOf(now)) / 86_400_000);
  if (diffDays >= -6 && diffDays <= 1) return relativeFormatter.format(diffDays, "day");
  return date.getFullYear() === now.getFullYear() ? shortDate.format(date) : shortDateYear.format(date);
}

/** Iniciais para avatar: "Maria Clara Souza" → "MS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toLocaleUpperCase(DEFAULT_LOCALE);
}

/** "2026-11-10" (data civil) → Date local à meia-noite, para exibição. */
export function civilToLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Data civil de hoje no fuso do navegador/servidor. */
export function todayCivil(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const timeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, { hour: "2-digit", minute: "2-digit" });

/** "há 5 min", "há 2 h", "ontem", "12 de out." */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffMin < 6 * 60) return `há ${Math.floor(diffMin / 60)} h`;
  const day = formatRelativeDay(date, now);
  return day === "hoje" ? `hoje, ${timeFormatter.format(date)}` : day;
}

/** "2026-12-10" → "10 de dez. de 2026" (data civil, sem fuso). */
export function formatCivilDate(civil: string): string {
  const [y, m, d] = civil.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
