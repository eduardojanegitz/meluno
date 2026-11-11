import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";

export type Tx = Prisma.TransactionClient;

/**
 * Autorização por recurso. Toda leitura ou escrita de um grupo passa por aqui.
 * Quem não é membro ativo recebe NOT_FOUND — nunca FORBIDDEN — para não
 * revelar a existência de grupos de terceiros.
 */
export async function requireMember(tx: Tx, viewer: Viewer, groupId: string) {
  const member = await tx.groupMember.findFirst({
    where: { groupId, userId: viewer.userId, status: "ACTIVE" },
    include: { group: true },
  });
  if (!member) throw new AppError("NOT_FOUND", "Grupo não encontrado.");
  return member;
}

export async function requireAdmin(tx: Tx, viewer: Viewer, groupId: string) {
  const member = await requireMember(tx, viewer, groupId);
  if (member.role !== "ADMIN") throw new AppError("FORBIDDEN", "Apenas administradores do grupo podem fazer isso.");
  return member;
}

/** Grupo arquivado é somente leitura. */
export function assertWritable(group: { archivedAt: Date | null }) {
  if (group.archivedAt) throw new AppError("FORBIDDEN", "Este grupo está arquivado.");
}

/**
 * Serializa escritas financeiras de um mesmo grupo (SELECT … FOR UPDATE na
 * linha do grupo). Garante que verificações como "saldo zero para sair"
 * não sofram corrida com uma despesa criada ao mesmo tempo.
 */
export async function lockGroup(tx: Tx, groupId: string) {
  await tx.$queryRaw`SELECT id FROM "group" WHERE id = ${groupId}::uuid FOR UPDATE`;
}

/**
 * Garante que todos os ids pertencem ao grupo. Novos participantes precisam
 * estar ativos ou provisórios; `allowInactive` aceita ex-membros já presentes
 * na versão anterior de uma despesa (edição).
 */
export async function assertGroupMembers(tx: Tx, groupId: string, memberIds: string[], allowInactive: Set<string> = new Set()) {
  const unique = [...new Set(memberIds)];
  const members = await tx.groupMember.findMany({ where: { groupId, id: { in: unique } }, select: { id: true, status: true } });
  if (members.length !== unique.length) throw new AppError("VALIDATION", "Alguma pessoa escolhida não faz parte do grupo.");
  for (const m of members) {
    if ((m.status === "LEFT" || m.status === "REMOVED") && !allowInactive.has(m.id)) {
      throw new AppError("VALIDATION", "Alguma pessoa escolhida não faz mais parte do grupo.");
    }
  }
}
