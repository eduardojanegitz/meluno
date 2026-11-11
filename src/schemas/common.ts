import { z } from "zod";

export const idSchema = z.uuid("Identificador inválido.");

/** Data civil "AAAA-MM-DD" (sem fuso). */
export const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "Data inválida.")
  .refine((v) => v >= "2000-01-01" && v <= "2100-12-31", "Data fora do intervalo permitido.");

export const amountMinorSchema = z
  .number({ error: "Informe um valor." })
  .int("Valor inválido.")
  .positive("O valor precisa ser maior que zero.")
  .max(1_000_000_000, "Valor acima do limite (R$ 10 milhões).");

export const currencySchema = z.enum(["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "UYU", "PYG", "JPY", "CAD", "AUD", "CHF", "MXN", "COP", "PEN"]);

export const idempotencyKeySchema = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

/** "2026-11-10" → Date em UTC 00:00 (persistido em coluna DATE). */
export function civilDateToDb(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function dbDateToCivil(value: Date): string {
  return value.toISOString().slice(0, 10);
}
