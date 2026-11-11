import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Sessão da requisição atual (deduplicada por render).
 * Com Cache Components, quem chama precisa estar dentro de <Suspense>.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Contexto mínimo do usuário autenticado, repassado aos services. */
export type Viewer = { userId: string; name: string; email: string };

/** Para páginas: redireciona para o login se não houver sessão válida. */
export async function requireViewer(): Promise<Viewer> {
  const session = await getSession();
  // O parâmetro impede o proxy de devolver para /inicio quando o cookie existe mas a sessão foi revogada.
  if (!session) redirect("/entrar?sessao=expirada");
  return { userId: session.user.id, name: session.user.name, email: session.user.email };
}
