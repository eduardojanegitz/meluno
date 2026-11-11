import { z } from "zod";
import { amountMinorSchema, civilDateSchema, currencySchema, idSchema } from "./common";

export const expenseCategorySchema = z.enum(["FOOD", "GROCERIES", "TRANSPORT", "HOUSING", "UTILITIES", "LEISURE", "TRAVEL", "EVENTS", "OTHER"]);
export const splitMethodSchema = z.enum(["EQUAL", "EXACT", "PERCENT", "SHARES", "ITEMS"]);

export const expenseItemSchema = z.object({
  description: z.string().trim().min(1, "Dê um nome ao item.").max(80, "Use no máximo 80 caracteres."),
  amountMinor: z.number().int().positive("O item precisa ter valor."),
  memberIds: z.array(idSchema).min(1, "Escolha quem consumiu.").max(100),
});

const expenseFields = {
  groupId: idSchema,
  description: z.string().trim().min(1, "O que foi essa despesa?").max(120, "Use no máximo 120 caracteres."),
  amountMinor: amountMinorSchema,
  date: civilDateSchema,
  category: expenseCategorySchema.default("OTHER"),
  notes: z.string().trim().max(1000, "Use no máximo 1000 caracteres.").optional().transform((v) => v || undefined),
  payers: z
    .array(z.object({ memberId: idSchema, amountMinor: z.number().int().positive() }))
    .min(1, "Informe quem pagou.")
    .max(100),
  split: z.object({
    method: splitMethodSchema,
    /** value: EXACT = centavos; PERCENT = pontos-base; SHARES = partes × 100; ignorado em EQUAL. */
    entries: z
      .array(z.object({ memberId: idSchema, value: z.number().int().min(0).optional() }))
      .min(1, "Escolha quem participou.")
      .max(100),
    /** Só em ITEMS: itens, taxa de serviço (pontos-base) e taxas fixas (centavos). */
    items: z.array(expenseItemSchema).max(60, "Use no máximo 60 itens.").optional(),
    serviceBp: z.number().int().min(0).max(3000).optional(),
    feesMinor: z.number().int().min(0).optional(),
  }),
  /** Despesa em outra moeda: valor original e cotação ("5,5517"). amountMinor é o convertido. */
  foreign: z
    .object({
      currency: currencySchema,
      amountMinor: amountMinorSchema,
      rate: z.string().trim().min(1, "Informe a cotação.").max(20),
    })
    .optional(),
};

/**
 * O id é gerado no cliente: serve de chave de idempotência (reenvios não
 * duplicam) e de semente do arredondamento — a prévia exibida antes de salvar
 * é exatamente o que será gravado.
 */
export const createExpenseSchema = z
  .object({
    ...expenseFields,
    expenseId: idSchema,
    /** Repetir automaticamente a partir da data da despesa. */
    repeat: z.enum(["WEEKLY", "MONTHLY"]).optional(),
  })
  .refine((v) => !(v.repeat && v.split.method === "ITEMS"), { message: "Despesas divididas por item não podem se repetir.", path: ["repeat"] })
  // A cotação muda; repetir com a mesma cotação para sempre daria valores errados.
  .refine((v) => !(v.repeat && v.foreign), { message: "Despesas em outra moeda não podem se repetir.", path: ["repeat"] });

export const updateExpenseSchema = z.object({
  ...expenseFields,
  expenseId: idSchema,
  /** Versão que o usuário estava editando (lock otimista). */
  version: z.number().int().positive(),
});

export const expenseRefSchema = z.object({ groupId: idSchema, expenseId: idSchema });

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
