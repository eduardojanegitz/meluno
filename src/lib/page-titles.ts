import "server-only";
import type { Metadata } from "next";
import { getSession } from "@/server/auth/session";
import { getPageTitles } from "@/server/services/queries";
import { idSchema } from "@/schemas/common";

type Params = Promise<{ groupId: string; expenseId?: string }>;

/**
 * Monta o título de páginas de grupo/despesa ("Supermercado · Viagem").
 * `build` recebe os nomes encontrados; sem acesso cai em `fallback`.
 */
export async function groupPageMetadata(
  params: Params,
  fallback: string,
  build: (t: { group: string; expense: string | null }) => string,
): Promise<Metadata> {
  const { groupId, expenseId } = await params;
  if (!idSchema.safeParse(groupId).success || (expenseId && !idSchema.safeParse(expenseId).success)) return { title: fallback };
  const session = await getSession();
  if (!session) return { title: fallback };
  const titles = await getPageTitles(session.user.id, groupId, expenseId);
  return { title: titles ? build(titles) : fallback };
}
