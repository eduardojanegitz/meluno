/**
 * Datas das despesas recorrentes, sempre em data civil "AAAA-MM-DD" (sem fuso).
 * Mensal: mesmo dia do mês; 29, 30 e 31 caem no último dia dos meses mais curtos
 * (31/jan → 28/fev → 31/mar). Semanal: +7 dias.
 */
export type Frequency = "WEEKLY" | "MONTHLY";

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

export function nextOccurrence(date: string, frequency: Frequency, anchorDay: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  if (frequency === "WEEKLY") {
    const t = new Date(Date.UTC(y, m - 1, d + 7));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(anchorDay, daysInMonth(ny, nm)))}`;
}

/** Primeira ocorrência estritamente depois de `today` (para retomar sem lançar as perdidas). */
export function firstOccurrenceAfter(start: string, today: string, frequency: Frequency, anchorDay: number): string {
  let date = start;
  for (let i = 0; date <= today && i < 10_000; i++) date = nextOccurrence(date, frequency, anchorDay);
  return date;
}

/** Hoje no Brasil (o app é pt-BR; o agendador roda em UTC). */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
