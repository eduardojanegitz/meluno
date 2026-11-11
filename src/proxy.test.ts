import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const SESSION = "meluno.session_token=abc.def";

function run(path: string, cookie?: string) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"), { headers: cookie ? { cookie } : {} });
  const res = proxy(req);
  return res.headers.get("location");
}

describe("proxy (redirecionamento otimista)", () => {
  it("manda visitante sem sessão para o login, preservando o destino", () => {
    const loc = run("/grupos/abc?aba=saldos");
    expect(loc).not.toBeNull();
    const url = new URL(loc!);
    expect(url.pathname).toBe("/entrar");
    expect(url.searchParams.get("next")).toBe("/grupos/abc?aba=saldos");
  });

  it("deixa páginas públicas passarem", () => {
    expect(run("/")).toBeNull();
    expect(run("/entrar")).toBeNull();
    expect(run("/conta-excluida")).toBeNull();
  });

  it("leva quem já tem sessão da landing e do login para o início", () => {
    expect(new URL(run("/", SESSION)!).pathname).toBe("/inicio");
    expect(new URL(run("/entrar", SESSION)!).pathname).toBe("/inicio");
  });

  it("não cria laço quando o cookie existe mas a sessão foi revogada", () => {
    expect(run("/entrar?sessao=expirada", SESSION)).toBeNull();
  });
});
