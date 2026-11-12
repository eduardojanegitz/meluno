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

describe("proxy: convites (Etapa 18)", () => {
  it("o convite e a imagem da prévia são públicos (quem ainda não entrou, robô do WhatsApp)", () => {
    expect(run("/convites/abcDEF123_-xyz")).toBeNull();
    expect(run("/convites/abcDEF123_-xyz/opengraph-image")).toBeNull();
    expect(run("/convites/abcDEF123_-xyz/opengraph-image-1a2b3c")).toBeNull();
  });

  it("a lista de convites e outros caminhos abaixo do convite pedem login", () => {
    expect(new URL(run("/convites")!).searchParams.get("next")).toBe("/convites");
    expect(new URL(run("/convites/abc/outra-coisa")!).pathname).toBe("/entrar");
  });
});
