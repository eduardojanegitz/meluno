import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { auth } from "@/server/auth/auth";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { compareIds } from "@/server/domain/money";
import { lockGroup } from "./access";
import { logActivity } from "./activity";

export const REMOVED_NAME = "Usuário removido";
export const DELETE_CONFIRMATION = "EXCLUIR";
/** Contas sem senha (só Google) precisam de login recente para excluir. */
export const FRESH_SESSION_SECONDS = 15 * 60;

export const deleteAccountSchema = z.object({
  confirmation: z.string().trim().refine((v) => v.toUpperCase() === DELETE_CONFIRMATION, `Digite ${DELETE_CONFIRMATION} para confirmar.`),
  password: z.string().max(128).optional(),
});

type ReauthInput = { password?: string; sessionCreatedAt: Date };

/**
 * Reautenticação antes de uma ação irreversível:
 * conta com senha → exige a senha; conta só social → exige sessão recente.
 */
async function assertReauthenticated(userId: string, { password, sessionCreatedAt }: ReauthInput) {
  const credential = await db.account.findFirst({ where: { userId, providerId: "credential" }, select: { password: true } });
  if (credential?.password) {
    if (!password) throw new AppError("VALIDATION", "Digite sua senha para confirmar.");
    const ctx = await auth.$context;
    const ok = await ctx.password.verify({ hash: credential.password, password });
    if (!ok) throw new AppError("VALIDATION", "Senha incorreta.");
    return;
  }
  if (Date.now() - sessionCreatedAt.getTime() > FRESH_SESSION_SECONDS * 1000) {
    throw new AppError("VALIDATION", "Por segurança, saia e entre de novo antes de excluir a conta.");
  }
}

/**
 * Exclusão de conta (LGPD, ADR 0001 §7 e ADR 0004).
 *
 * Numa única transação:
 *  - nos grupos, o membro vira "Usuário removido" (status LEFT, sem e-mail) e os
 *    registros financeiros permanecem — eles compõem os saldos das outras pessoas;
 *  - se era o único administrador ativo, o membro ativo mais antigo é promovido;
 *    grupo sem nenhum outro membro ativo é arquivado;
 *  - o nome é removido do histórico (payloads de atividade) e das notificações
 *    enviadas a outras pessoas sobre ele;
 *  - convites para o seu e-mail e o e-mail de membros provisórios são apagados;
 *  - a linha do usuário é excluída: sessões, contas de login, chaves Pix,
 *    preferências e notificações saem em cascata.
 */
export async function deleteAccount(viewer: Viewer, raw: z.input<typeof deleteAccountSchema>, reauth: { sessionCreatedAt: Date }) {
  const input = deleteAccountSchema.parse(raw);
  await assertReauthenticated(viewer.userId, { password: input.password, sessionCreatedAt: reauth.sessionCreatedAt });

  const email = viewer.email.toLowerCase();

  await db.$transaction(async (tx) => {
    const memberships = await tx.groupMember.findMany({
      where: { userId: viewer.userId },
      select: { id: true, groupId: true, status: true, role: true, displayName: true },
    });
    // Ordem fixa de lock entre grupos evita deadlock com outras transações.
    const groupIds = [...new Set(memberships.map((m) => m.groupId))].sort(compareIds);
    for (const groupId of groupIds) await lockGroup(tx, groupId);

    const now = new Date();
    for (const m of memberships) {
      const wasActive = m.status === "ACTIVE";
      if (wasActive && m.role === "ADMIN") {
        const otherAdmins = await tx.groupMember.count({ where: { groupId: m.groupId, status: "ACTIVE", role: "ADMIN", id: { not: m.id } } });
        if (otherAdmins === 0) {
          const successor = await tx.groupMember.findFirst({
            where: { groupId: m.groupId, status: "ACTIVE", id: { not: m.id } },
            orderBy: [{ joinedAt: "asc" }, { createdAt: "asc" }],
            select: { id: true, displayName: true },
          });
          if (successor) {
            await tx.groupMember.update({ where: { id: successor.id }, data: { role: "ADMIN" } });
            await logActivity(tx, {
              groupId: m.groupId,
              actorMemberId: null,
              type: "MEMBER_ROLE_CHANGED",
              entityType: "member",
              entityId: successor.id,
              payload: { name: successor.displayName, role: "ADMIN", reason: "account_deleted" },
            });
          }
        }
      }

      await tx.groupMember.update({
        where: { id: m.id },
        data: {
          displayName: REMOVED_NAME,
          email: null,
          role: "MEMBER",
          ...(wasActive ? { status: "LEFT", leftAt: now } : {}),
        },
      });
      if (wasActive) {
        await logActivity(tx, { groupId: m.groupId, actorMemberId: m.id, type: "MEMBER_LEFT", entityType: "member", entityId: m.id, payload: { name: REMOVED_NAME, reason: "account_deleted" } });
        const remaining = await tx.groupMember.count({ where: { groupId: m.groupId, status: "ACTIVE" } });
        if (remaining === 0) await tx.group.updateMany({ where: { id: m.groupId, archivedAt: null }, data: { archivedAt: now } });
      }
    }

    const memberIds = memberships.map((m) => m.id);
    if (memberIds.length > 0) {
      // Remove o nome dos registros de atividade sobre essa pessoa.
      await tx.$executeRaw`
        UPDATE activity_log SET payload = jsonb_set(payload, '{name}', to_jsonb(${REMOVED_NAME}::text))
        WHERE "entityType" = 'member' AND "entityId" = ANY(${memberIds}::uuid[]) AND payload ? 'name'`;
      // Notificações de outras pessoas que citam essa pessoa pelo nome nos grupos em comum.
      const names = [...new Set([viewer.name, ...memberships.map((m) => m.displayName)])];
      await tx.$executeRaw`
        UPDATE notification SET payload = jsonb_set(payload, '{name}', to_jsonb(${REMOVED_NAME}::text))
        WHERE "groupId" = ANY(${groupIds}::uuid[]) AND "userId" <> ${viewer.userId} AND payload->>'name' = ANY(${names}::text[])`;
    }

    // E-mail como dado pessoal fora da conta: convites e membros provisórios.
    await tx.groupInvitation.deleteMany({ where: { email } });
    await tx.groupMember.updateMany({ where: { email, status: "PROVISIONAL" }, data: { email: null } });

    // Tokens pendentes (redefinição de senha etc.) e contadores de rate limit da pessoa.
    await tx.verification.deleteMany({ where: { OR: [{ value: viewer.userId }, { identifier: { contains: email } }] } });
    await tx.$executeRaw`DELETE FROM rate_limit WHERE key LIKE ${`app:%:${viewer.userId}`}`;

    // Cascata: sessões, contas, chaves Pix, preferências, notificações.
    await tx.user.delete({ where: { id: viewer.userId } });
  });
}
