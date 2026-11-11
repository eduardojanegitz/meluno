import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { createInvitationSchema, invitationTokenSchema } from "@/schemas/group";
import { sendEmail } from "@/server/email/mailer";
import { invitationMessage } from "@/server/email/templates";
import { logger } from "@/server/logger";
import { enforceRateLimit } from "@/server/rate-limit";
import { assertWritable, requireMember } from "./access";
import { logActivity, notifyGroup } from "./activity";

const DAY = 86_400_000;
const LINK_TTL = 7 * DAY;
const EMAIL_TTL = 14 * DAY;

/**
 * Política de identidade (ADR 0001 §1):
 *  - Convite por e-mail só pode ser aceito por uma conta com o MESMO e-mail
 *    (verificado). Se aponta para um membro provisório, a conta assume esse membro.
 *  - Convite por link cria um membro novo — exceto se existir um provisório com
 *    o mesmo e-mail da conta, que é assumido automaticamente (evita duplicidade).
 *  - Quem já é membro ativo apenas é levado ao grupo.
 */

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationUrl(token: string) {
  return `${env().APP_URL}/convites/${token}`;
}

export async function createInvitation(viewer: Viewer, raw: z.input<typeof createInvitationSchema>) {
  const input = createInvitationSchema.parse(raw);
  await enforceRateLimit(`invite:${viewer.userId}`, 30, 3600);
  const token = randomBytes(32).toString("base64url");

  const result = await db.$transaction(async (tx) => {
    // Link: qualquer membro pode gerar. E-mail: qualquer membro (convidar é colaborativo).
    const me = await requireMember(tx, viewer, input.groupId);
    assertWritable(me.group);

    let targetMemberId: string | null = null;
    if (input.kind === "EMAIL") {
      if (input.email === viewer.email.toLowerCase()) throw new AppError("VALIDATION", "Esse é o seu próprio e-mail.");
      const existing = await tx.groupMember.findFirst({
        where: { groupId: input.groupId, status: "ACTIVE", user: { email: input.email } },
      });
      if (existing) throw new AppError("CONFLICT", "Essa pessoa já participa do grupo.");

      if (input.memberId) {
        const target = await tx.groupMember.findFirst({ where: { id: input.memberId, groupId: input.groupId, status: "PROVISIONAL" } });
        if (!target) throw new AppError("NOT_FOUND", "Pessoa não encontrada no grupo.");
        if (target.email && target.email !== input.email) {
          throw new AppError("VALIDATION", "Esse membro já tem outro e-mail cadastrado.");
        }
        const clash = await tx.groupMember.findFirst({ where: { groupId: input.groupId, email: input.email, id: { not: target.id } } });
        if (clash) throw new AppError("CONFLICT", "Já existe outra pessoa com esse e-mail no grupo.");
        await tx.groupMember.update({ where: { id: target.id }, data: { email: input.email } });
        targetMemberId = target.id;
      } else {
        // Reaproveita provisório com o mesmo e-mail, se houver.
        const sameEmail = await tx.groupMember.findFirst({ where: { groupId: input.groupId, email: input.email, status: "PROVISIONAL" } });
        targetMemberId = sameEmail?.id ?? null;
      }
      // Um convite pendente por e-mail e grupo: revoga os anteriores.
      await tx.groupInvitation.updateMany({
        where: { groupId: input.groupId, email: input.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const invitation = await tx.groupInvitation.create({
      data: {
        groupId: input.groupId,
        kind: input.kind,
        email: input.kind === "EMAIL" ? input.email : null,
        targetMemberId,
        tokenHash: hashToken(token),
        invitedByMemberId: me.id,
        expiresAt: new Date(Date.now() + (input.kind === "LINK" ? LINK_TTL : EMAIL_TTL)),
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      actorMemberId: me.id,
      type: "INVITATION_SENT",
      entityType: "invitation",
      entityId: invitation.id,
      payload: { kind: input.kind },
    });

    if (input.kind === "EMAIL") {
      const invitedUser = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (invitedUser) {
        await tx.notification.create({
          data: { userId: invitedUser.id, type: "INVITATION_RECEIVED", groupId: input.groupId, payload: { groupName: me.group.name, by: me.displayName } },
        });
      }
    }
    return { invitationId: invitation.id, groupName: me.group.name, inviterName: me.displayName, expiresAt: invitation.expiresAt };
  });

  const url = invitationUrl(token);
  if (input.kind === "EMAIL") {
    sendEmail(invitationMessage(input.email, result.inviterName, result.groupName, url)).catch(() =>
      logger.error("invite.email_failed", { invitationId: result.invitationId }),
    );
  }
  return { url, expiresAt: result.expiresAt };
}

export async function revokeInvitation(viewer: Viewer, groupId: string, invitationId: string) {
  return db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, groupId);
    const inv = await tx.groupInvitation.findFirst({ where: { id: invitationId, groupId, acceptedAt: null, revokedAt: null } });
    if (!inv) throw new AppError("NOT_FOUND", "Convite não encontrado.");
    if (inv.invitedByMemberId !== me.id && me.role !== "ADMIN") throw new AppError("FORBIDDEN");
    await tx.groupInvitation.update({ where: { id: inv.id }, data: { revokedAt: new Date() } });
    await logActivity(tx, { groupId, actorMemberId: me.id, type: "INVITATION_REVOKED", entityType: "invitation", entityId: inv.id });
  });
}

type InvitationState = "VALID" | "EXPIRED" | "REVOKED" | "USED" | "INVALID";

async function findByToken(token: string) {
  const parsed = invitationTokenSchema.safeParse({ token });
  if (!parsed.success) return null;
  return db.groupInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: invitationInclude });
}

function stateOf(inv: NonNullable<Awaited<ReturnType<typeof findByToken>>>): InvitationState {
  if (inv.revokedAt || inv.group.archivedAt) return "REVOKED";
  if (inv.kind === "EMAIL" && inv.acceptedAt) return "USED";
  if (inv.maxUses !== null && inv.useCount >= inv.maxUses) return "USED";
  if (inv.expiresAt.getTime() < Date.now()) return "EXPIRED";
  return "VALID";
}

/** Prévia pública mínima do convite (sem dados de membros). */
export async function previewInvitation(viewer: Viewer, token: string) {
  const inv = await findByToken(token);
  if (!inv) return { state: "INVALID" as const };
  const alreadyMember = await db.groupMember.findFirst({ where: { groupId: inv.groupId, userId: viewer.userId, status: "ACTIVE" }, select: { id: true } });
  return {
    state: stateOf(inv),
    alreadyMember: Boolean(alreadyMember),
    groupId: inv.groupId,
    groupName: inv.group.name,
    category: inv.group.category,
    memberCount: inv.group._count.members,
    inviterName: inv.invitedBy.displayName,
    kind: inv.kind,
    emailMismatch: inv.kind === "EMAIL" && inv.email !== viewer.email.toLowerCase(),
  };
}

export async function acceptInvitation(viewer: Viewer, token: string) {
  const inv = await findByToken(token);
  if (!inv) throw new AppError("NOT_FOUND", "Convite inválido.");
  return acceptLoaded(viewer, inv);
}

const invitationInclude = {
  group: {
    select: {
      id: true,
      name: true,
      category: true,
      archivedAt: true,
      _count: { select: { members: { where: { status: { in: ["ACTIVE", "PROVISIONAL"] as ("ACTIVE" | "PROVISIONAL")[] } } } } },
    },
  },
  invitedBy: { select: { displayName: true } },
} as const;

async function acceptLoaded(viewer: Viewer, inv: NonNullable<Awaited<ReturnType<typeof findByToken>>>) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "group" WHERE id = ${inv.groupId}::uuid FOR UPDATE`;
    const fresh = await tx.groupInvitation.findUniqueOrThrow({ where: { id: inv.id } });
    const state = stateOf({ ...inv, ...fresh });
    if (state !== "VALID") {
      throw new AppError("VALIDATION", state === "EXPIRED" ? "Este convite expirou. Peça um novo." : "Este convite não está mais disponível.");
    }

    const existing = await tx.groupMember.findFirst({ where: { groupId: inv.groupId, userId: viewer.userId } });
    if (existing?.status === "ACTIVE") return { groupId: inv.groupId };

    const viewerEmail = viewer.email.toLowerCase();
    if (inv.kind === "EMAIL" && inv.email !== viewerEmail) {
      throw new AppError("FORBIDDEN", "Este convite foi enviado para outro e-mail. Entre com a conta desse e-mail.");
    }

    // Quem será assumido: o alvo do convite ou um provisório com o mesmo e-mail.
    const target =
      (fresh.targetMemberId
        ? await tx.groupMember.findFirst({ where: { id: fresh.targetMemberId, status: "PROVISIONAL" } })
        : null) ?? (await tx.groupMember.findFirst({ where: { groupId: inv.groupId, email: viewerEmail, status: "PROVISIONAL" } }));

    let memberId: string;
    if (existing) {
      // Ex-membro voltando: reativa o mesmo registro (preserva histórico).
      await tx.groupMember.update({ where: { id: existing.id }, data: { status: "ACTIVE", leftAt: null, joinedAt: new Date(), displayName: viewer.name } });
      memberId = existing.id;
    } else if (target) {
      await tx.groupMember.update({
        where: { id: target.id },
        data: { userId: viewer.userId, status: "ACTIVE", email: null, displayName: viewer.name, joinedAt: new Date() },
      });
      memberId = target.id;
    } else {
      const m = await tx.groupMember.create({
        data: { groupId: inv.groupId, userId: viewer.userId, displayName: viewer.name, status: "ACTIVE", joinedAt: new Date() },
      });
      memberId = m.id;
    }

    await tx.groupInvitation.update({
      where: { id: inv.id },
      data: { useCount: { increment: 1 }, acceptedAt: inv.kind === "EMAIL" ? new Date() : fresh.acceptedAt },
    });
    await logActivity(tx, {
      groupId: inv.groupId,
      actorMemberId: memberId,
      type: "MEMBER_JOINED",
      entityType: "member",
      entityId: memberId,
      payload: { name: viewer.name, claimedProvisional: Boolean(target && !existing) },
    });
    await notifyGroup(tx, inv.groupId, viewer.userId, "MEMBER_JOINED", { name: viewer.name, groupName: inv.group.name });
    return { groupId: inv.groupId };
  });
}

/** Convites por e-mail pendentes para a conta atual (tela Convites). */
export async function listPendingInvitations(viewer: Viewer) {
  const invitations = await db.groupInvitation.findMany({
    where: {
      kind: "EMAIL",
      email: viewer.email.toLowerCase(),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      group: { archivedAt: null, members: { none: { userId: viewer.userId, status: "ACTIVE" } } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true, group: { select: { name: true, category: true } }, invitedBy: { select: { displayName: true } } },
  });
  return invitations;
}

/**
 * Aceite a partir da lista de convites (sem o token bruto, que só existe no e-mail).
 * Mesma política do aceite por token, restrita a convites para o e-mail da conta.
 */
export async function acceptInvitationById(viewer: Viewer, invitationId: string) {
  const inv = await db.groupInvitation.findFirst({
    where: { id: invitationId, kind: "EMAIL", email: viewer.email.toLowerCase() },
    include: invitationInclude,
  });
  if (!inv) throw new AppError("NOT_FOUND", "Convite não encontrado.");
  return acceptLoaded(viewer, inv);
}

export async function declineInvitation(viewer: Viewer, invitationId: string) {
  const result = await db.groupInvitation.updateMany({
    where: { id: invitationId, kind: "EMAIL", email: viewer.email.toLowerCase(), acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw new AppError("NOT_FOUND", "Convite não encontrado.");
}

export async function listGroupInvitations(viewer: Viewer, groupId: string) {
  return db.$transaction(async (tx) => {
    await requireMember(tx, viewer, groupId);
    return tx.groupInvitation.findMany({
      where: { groupId, revokedAt: null, expiresAt: { gt: new Date() }, OR: [{ kind: "LINK" }, { acceptedAt: null }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, email: true, expiresAt: true, useCount: true, invitedBy: { select: { displayName: true } } },
    });
  });
}
