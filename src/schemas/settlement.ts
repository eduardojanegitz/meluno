import { z } from "zod";
import { amountMinorSchema, civilDateSchema, idempotencyKeySchema, idSchema } from "./common";

export const createSettlementSchema = z
  .object({
    groupId: idSchema,
    fromMemberId: idSchema,
    toMemberId: idSchema,
    amountMinor: amountMinorSchema,
    date: civilDateSchema,
    method: z.enum(["PIX", "CASH", "TRANSFER", "OTHER"]).default("PIX"),
    note: z.string().trim().max(280).optional().transform((v) => v || undefined),
    idempotencyKey: idempotencyKeySchema,
  })
  .refine((v) => v.fromMemberId !== v.toMemberId, { path: ["toMemberId"], message: "Escolha duas pessoas diferentes." });

export const settlementRefSchema = z.object({ groupId: idSchema, settlementId: idSchema });

export type CreateSettlementInput = z.input<typeof createSettlementSchema>;
