import "server-only";
import type { Ledger } from "@/server/domain/balance";
import type { Tx } from "./access";

/**
 * Carrega os registros financeiros vigentes de um grupo no formato do domínio:
 * despesas não excluídas e acertos CONFIRMADOS não excluídos.
 */
export async function loadGroupLedger(tx: Tx, groupId: string): Promise<Ledger> {
  // Sequencial: dentro de uma transação há uma única conexão.
  const expenses = await tx.expense.findMany({
      where: { groupId, deletedAt: null },
      select: {
        id: true,
        payers: { select: { memberId: true, amountMinor: true } },
        splits: { select: { memberId: true, amountMinor: true } },
      },
  });
  const settlements = await tx.settlement.findMany({
    where: { groupId, deletedAt: null, status: "CONFIRMED" },
    select: { fromMemberId: true, toMemberId: true, amountMinor: true },
  });
  return { expenses, settlements };
}
