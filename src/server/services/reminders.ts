import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { idSchema } from "@/schemas/common";
import { computeBalances, pairwiseDebts, type Debt } from "@/server/domain/balance";
import { simplifyDebts } from "@/server/domain/simplify";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { buildPixPayload } from "@/lib/pix";
import { sendEmail } from "@/server/email/mailer";
import { paymentReminderMessage } from "@/server/email/templates";
import { logger } from "@/server/logger";
import { requireMember, type Tx } from "./access";
import { notifyGroup } from "./activity";
import { loadGroupLedger } from "./ledger";

/** Uma cobrança por dupla (quem recebe → quem deve) a cada 72 h, em qualquer canal. */
export const REMINDER_COOLDOWN_HOURS = 72;

export const reminderSchema = z.object({
  groupId: idSchema,
  debtorMemberId: idSchema,
  channel: z.enum(["EMAIL", "WHATSAPP"]),
});

/** Mesma sugestão que a tela de saldos mostra (simplificada ou por par). */
async function currentSuggestions(tx: Tx, groupId: string, simplify: boolean): Promise<Debt[]> {
  const ledger = await loadGroupLedger(tx, groupId);
  return simplify ? simplifyDebts(computeBalances(ledger)) : pairwiseDebts(ledger);
}

/**
 * Registra uma cobrança gentil de quem recebe para quem deve.
 *  - Só vale para uma dívida que aparece hoje nos acertos sugeridos.
 *  - EMAIL: envia e-mail + notificação no app (pessoa precisa ter conta).
 *  - WHATSAPP: só registra (para o limite); a mensagem é enviada pela própria
 *    pessoa, pelo WhatsApp dela — o Meluno não envia mensagens no WhatsApp.
 * Retorna o valor cobrado e o próximo horário permitido.
 */
export async function sendPaymentReminder(viewer: Viewer, raw: z.input<typeof reminderSchema>) {
  const input = reminderSchema.parse(raw);

  const result = await db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, input.groupId);
    if (me.group.archivedAt) throw new AppError("FORBIDDEN", "Este grupo está arquivado.");
    if (input.debtorMemberId === me.id) throw new AppError("VALIDATION", "Você não pode cobrar a si mesmo.");

    const debt = (await currentSuggestions(tx, input.groupId, me.group.simplifyDebts)).find(
      (d) => d.fromMemberId === input.debtorMemberId && d.toMemberId === me.id,
    );
    if (!debt) throw new AppError("VALIDATION", "Essa pessoa não tem nada a te pagar agora.");

    const last = await tx.paymentReminder.findFirst({
      where: { groupId: input.groupId, creditorMemberId: me.id, debtorMemberId: input.debtorMemberId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const cooldownMs = REMINDER_COOLDOWN_HOURS * 3600 * 1000;
    if (last && Date.now() - last.createdAt.getTime() < cooldownMs) {
      const hours = Math.ceil((last.createdAt.getTime() + cooldownMs - Date.now()) / 3600_000);
      throw new AppError("RATE_LIMITED", `Você já lembrou essa pessoa há pouco. Dá pra lembrar de novo em ${hours} h.`);
    }

    const debtor = await tx.groupMember.findFirstOrThrow({
      where: { id: input.debtorMemberId, groupId: input.groupId },
      select: { id: true, status: true, displayName: true, user: { select: { email: true, preferences: { select: { emailOnSettlement: true } } } } },
    });

    if (input.channel === "EMAIL") {
      if (debtor.status !== "ACTIVE" || !debtor.user) {
        throw new AppError("VALIDATION", `${debtor.displayName} ainda não tem conta no Meluno. Que tal mandar pelo WhatsApp?`);
      }
      if (debtor.user.preferences && !debtor.user.preferences.emailOnSettlement) {
        throw new AppError("VALIDATION", `${debtor.displayName} prefere não receber e-mails de cobrança. Que tal mandar pelo WhatsApp?`);
      }
    }

    await tx.paymentReminder.create({
      data: { groupId: input.groupId, creditorMemberId: me.id, debtorMemberId: debtor.id, amountMinor: debt.amountMinor, channel: input.channel },
    });

    if (input.channel === "EMAIL") {
      await notifyGroup(
        tx,
        input.groupId,
        viewer.userId,
        "PAYMENT_REMINDER",
        { by: me.displayName, amountMinor: debt.amountMinor, currency: me.group.currency, groupName: me.group.name },
        [debtor.id],
      );
    }

    const pixKey =
      me.group.currency === "BRL"
        ? await tx.pixKey.findFirst({ where: { userId: viewer.userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { value: true } })
        : null;

    return {
      amountMinor: debt.amountMinor,
      currency: me.group.currency,
      groupName: me.group.name,
      creditorName: me.displayName,
      debtorEmail: input.channel === "EMAIL" ? debtor.user!.email : null,
      pixCode: pixKey ? buildPixPayload({ key: pixKey.value, name: me.displayName, amountMinor: debt.amountMinor, description: `Meluno ${me.group.name}` }) : undefined,
    };
  });

  if (result.debtorEmail) {
    try {
      await sendEmail(
        paymentReminderMessage(result.debtorEmail, {
          creditorName: result.creditorName,
          groupName: result.groupName,
          amountLabel: formatMoney(result.amountMinor, { currency: result.currency }),
          url: `${env().APP_URL}/grupos/${input.groupId}?aba=saldos`,
          pixCode: result.pixCode,
        }),
      );
    } catch {
      // O registro já foi feito (conta no limite); a notificação no app chegou.
      logger.warn("reminder.email_failed");
    }
  }

  // pixCode é a própria chave de quem cobra (para colar na mensagem do WhatsApp).
  return { amountMinor: result.amountMinor, pixCode: result.pixCode ?? null };
}
