import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Redirecionamento otimista baseado apenas na presença do cookie de sessão.
 * NÃO é a verificação de segurança: toda página e ação autenticada valida a
 * sessão no servidor (requireViewer / services).
 */
const AUTH_PAGES = ["/entrar", "/criar-conta", "/recuperar-senha", "/redefinir-senha"];
const APP_PREFIXES = ["/inicio", "/grupos", "/atividade", "/perfil", "/convites"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request, { cookiePrefix: "meluno" }));

  if (!hasSession && APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/entrar", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && (pathname === "/" || AUTH_PAGES.slice(0, 2).includes(pathname))) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icon.svg|apple-icon|icons/|manifest.webmanifest|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
