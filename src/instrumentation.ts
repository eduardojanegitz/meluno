import type { Instrumentation } from "next";

/** Erros do servidor (Server Components, Server Actions, Route Handlers, proxy). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { reportError } = await import("@/server/observability");
  const e = err instanceof Error ? err : new Error(String(err));
  await reportError({
    source: "server",
    name: e.name,
    message: e.message,
    digest: typeof err === "object" && err && "digest" in err ? String((err as { digest: unknown }).digest) : undefined,
    // routePath é o padrão da rota ("/grupos/[groupId]"), sem ids.
    route: context.routePath || request.path,
    method: request.method,
    kind: `${context.routeType}${context.renderSource ? `/${context.renderSource}` : ""}`,
  });
};
