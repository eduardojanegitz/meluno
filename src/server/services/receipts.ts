import "server-only";
import type { Viewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { JpegError, stripJpegMetadata } from "@/server/domain/jpeg";
import { assertWritable, requireMember } from "./access";

/** Depois da compressão no navegador uma foto de cupom fica em ~200–500 KB. */
export const MAX_RECEIPT_BYTES = 1_500_000;

/**
 * Armazenamento dos comprovantes: no próprio Postgres (tabela expense_receipt).
 * Para trocar por armazenamento de objetos (R2/S3), basta reimplementar estas três funções.
 */
async function loadExpense(viewer: Viewer, groupId: string, expenseId: string) {
  return db.$transaction(async (tx) => {
    const me = await requireMember(tx, viewer, groupId);
    const expense = await tx.expense.findFirst({
      where: { id: expenseId, groupId, deletedAt: null },
      select: { id: true, createdByMemberId: true, payers: { select: { memberId: true } } },
    });
    if (!expense) throw new AppError("NOT_FOUND", "Despesa não encontrada.");
    return { me, expense };
  });
}

/** Quem pode anexar/trocar/remover: quem lançou, quem pagou ou um administrador. */
function canManage(me: { id: string; role: string; status: string }, expense: { createdByMemberId: string; payers: { memberId: string }[] }) {
  return me.status === "ACTIVE" && (me.role === "ADMIN" || expense.createdByMemberId === me.id || expense.payers.some((p) => p.memberId === me.id));
}

export async function putReceipt(viewer: Viewer, groupId: string, expenseId: string, bytes: Uint8Array) {
  const { me, expense } = await loadExpense(viewer, groupId, expenseId);
  assertWritable(me.group);
  if (!canManage(me, expense)) throw new AppError("FORBIDDEN", "Só quem lançou, quem pagou ou um administrador pode anexar o comprovante.");
  if (bytes.length === 0 || bytes.length > MAX_RECEIPT_BYTES) throw new AppError("VALIDATION", "A foto precisa ter até 1,5 MB.");

  let clean: Uint8Array;
  try {
    clean = stripJpegMetadata(bytes);
  } catch (error) {
    if (error instanceof JpegError) throw new AppError("VALIDATION", "Envie uma foto em JPEG.");
    throw error;
  }
  const data = Buffer.from(clean);
  await db.expenseReceipt.upsert({
    where: { expenseId },
    create: { expenseId, contentType: "image/jpeg", data, sizeBytes: data.length, uploadedByMemberId: me.id },
    update: { contentType: "image/jpeg", data, sizeBytes: data.length, uploadedByMemberId: me.id, createdAt: new Date() },
  });
  return { sizeBytes: data.length };
}

export async function getReceipt(viewer: Viewer, groupId: string, expenseId: string) {
  await loadExpense(viewer, groupId, expenseId);
  const receipt = await db.expenseReceipt.findUnique({ where: { expenseId }, select: { contentType: true, data: true, createdAt: true } });
  if (!receipt) throw new AppError("NOT_FOUND", "Esta despesa não tem comprovante.");
  return receipt;
}

export async function deleteReceipt(viewer: Viewer, groupId: string, expenseId: string) {
  const { me, expense } = await loadExpense(viewer, groupId, expenseId);
  assertWritable(me.group);
  if (!canManage(me, expense)) throw new AppError("FORBIDDEN", "Só quem lançou, quem pagou ou um administrador pode remover o comprovante.");
  await db.expenseReceipt.deleteMany({ where: { expenseId } });
}
