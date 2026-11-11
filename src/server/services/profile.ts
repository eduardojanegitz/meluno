import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { nameSchema } from "@/schemas/auth";
import { currencySchema, idSchema } from "@/schemas/common";

export const updateProfileSchema = z.object({
  name: nameSchema,
  defaultCurrency: currencySchema,
  emailOnExpense: z.boolean(),
  emailOnSettlement: z.boolean(),
  emailOnInvitation: z.boolean(),
});

export const pixKeySchema = z
  .object({
    type: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]),
    value: z.string().trim().min(1, "Informe a chave.").max(140),
    label: z.string().trim().max(40).optional().transform((v) => v || undefined),
  })
  .transform((v, ctx) => {
    const digits = v.value.replace(/\D/g, "");
    const fail = (message: string) => {
      ctx.addIssue({ code: "custom", path: ["value"], message });
      return z.NEVER;
    };
    switch (v.type) {
      case "CPF":
        return digits.length === 11 ? { ...v, value: digits } : fail("CPF precisa ter 11 dígitos.");
      case "CNPJ":
        return digits.length === 14 ? { ...v, value: digits } : fail("CNPJ precisa ter 14 dígitos.");
      case "PHONE": {
        const n = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
        return n.length === 10 || n.length === 11 ? { ...v, value: `+55${n}` } : fail("Telefone inválido. Use DDD + número.");
      }
      case "EMAIL":
        return z.email().safeParse(v.value.toLowerCase()).success ? { ...v, value: v.value.toLowerCase() } : fail("E-mail inválido.");
      case "RANDOM":
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.value)
          ? { ...v, value: v.value.toLowerCase() }
          : fail("Chave aleatória inválida.");
    }
  });

export async function getProfile(viewer: Viewer) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: viewer.userId },
    select: {
      name: true,
      email: true,
      image: true,
      preferences: true,
      pixKeys: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      accounts: { select: { providerId: true } },
    },
  });
  return {
    ...user,
    hasPassword: user.accounts.some((a) => a.providerId === "credential"),
    hasGoogle: user.accounts.some((a) => a.providerId === "google"),
    preferences: user.preferences ?? { defaultCurrency: "BRL", emailOnExpense: false, emailOnSettlement: true, emailOnInvitation: true },
  };
}

export async function updateProfile(viewer: Viewer, raw: z.input<typeof updateProfileSchema>) {
  const input = updateProfileSchema.parse(raw);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: viewer.userId }, data: { name: input.name } });
    // O nome exibido nos grupos acompanha o perfil.
    await tx.groupMember.updateMany({ where: { userId: viewer.userId, status: "ACTIVE" }, data: { displayName: input.name } });
    const prefs = {
      defaultCurrency: input.defaultCurrency,
      emailOnExpense: input.emailOnExpense,
      emailOnSettlement: input.emailOnSettlement,
      emailOnInvitation: input.emailOnInvitation,
    };
    await tx.userPreferences.upsert({ where: { userId: viewer.userId }, create: { userId: viewer.userId, ...prefs }, update: prefs });
  });
}

export async function addPixKey(viewer: Viewer, raw: z.input<typeof pixKeySchema>) {
  const input = pixKeySchema.parse(raw);
  const count = await db.pixKey.count({ where: { userId: viewer.userId } });
  if (count >= 5) throw new AppError("VALIDATION", "Você pode cadastrar até 5 chaves Pix.");
  try {
    await db.pixKey.create({ data: { userId: viewer.userId, ...input, isDefault: count === 0 } });
  } catch {
    throw new AppError("CONFLICT", "Essa chave já está cadastrada.");
  }
}

export async function removePixKey(viewer: Viewer, id: string) {
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const key = await tx.pixKey.findFirst({ where: { id, userId: viewer.userId } });
    if (!key) throw new AppError("NOT_FOUND");
    await tx.pixKey.delete({ where: { id } });
    if (key.isDefault) {
      const next = await tx.pixKey.findFirst({ where: { userId: viewer.userId }, orderBy: { createdAt: "asc" } });
      if (next) await tx.pixKey.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

/**
 * Chave Pix de um membro, visível apenas para quem compartilha o grupo com ele
 * (como membro ativo). Exibir a chave não registra nem confirma pagamento.
 */
export async function getMemberPixKeys(viewer: Viewer, groupId: string, memberId: string) {
  const me = await db.groupMember.findFirst({ where: { groupId, userId: viewer.userId, status: "ACTIVE" }, select: { id: true } });
  if (!me) throw new AppError("NOT_FOUND", "Grupo não encontrado.");
  const target = await db.groupMember.findFirst({ where: { id: memberId, groupId, status: "ACTIVE" }, select: { userId: true } });
  if (!target?.userId) return [];
  return db.pixKey.findMany({
    where: { userId: target.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, type: true, value: true, label: true },
  });
}
