import { z } from "zod";
import { currencySchema, idSchema } from "./common";
import { emailSchema } from "./auth";

export const groupCategorySchema = z.enum(["TRIP", "HOME", "COUPLE", "EVENT", "FRIENDS", "OTHER"]);

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao grupo.").max(60, "Use no máximo 60 caracteres."),
  description: z.string().trim().max(280, "Use no máximo 280 caracteres.").optional().transform((v) => v || undefined),
  category: groupCategorySchema.default("OTHER"),
  currency: currencySchema.default("BRL"),
  /** Pessoas adicionadas já na criação (provisórias até aceitarem convite). */
  people: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Informe o nome.").max(60),
        email: z.union([emailSchema, z.literal("").transform(() => undefined)]).optional(),
      }),
    )
    .max(50)
    .default([]),
});

export const updateGroupSchema = z.object({
  groupId: idSchema,
  name: z.string().trim().min(2, "Dê um nome ao grupo.").max(60),
  description: z.string().trim().max(280).optional().transform((v) => v || undefined),
  category: groupCategorySchema,
  simplifyDebts: z.boolean(),
});

export const addMemberSchema = z.object({
  groupId: idSchema,
  name: z.string().trim().min(1, "Informe o nome.").max(60),
  email: z.union([emailSchema, z.literal("").transform(() => undefined)]).optional(),
});

export const memberActionSchema = z.object({ groupId: idSchema, memberId: idSchema });

export const changeRoleSchema = memberActionSchema.extend({ role: z.enum(["ADMIN", "MEMBER"]) });

export const createInvitationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("LINK"), groupId: idSchema }),
  z.object({ kind: z.literal("EMAIL"), groupId: idSchema, email: emailSchema, memberId: idSchema.optional() }),
]);

export const invitationTokenSchema = z.object({ token: z.string().min(20).max(100).regex(/^[A-Za-z0-9_-]+$/) });

export type CreateGroupInput = z.input<typeof createGroupSchema>;
