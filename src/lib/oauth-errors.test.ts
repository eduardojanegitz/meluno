import { describe, expect, it } from "vitest";
import { oauthErrorMessage } from "./oauth-errors";

describe("oauthErrorMessage", () => {
  it("sem código, sem mensagem", () => {
    expect(oauthErrorMessage(null)).toBeNull();
    expect(oauthErrorMessage("")).toBeNull();
  });

  it("explica a conta não confirmada sem vincular", () => {
    expect(oauthErrorMessage("account_not_linked")).toMatch(/esperando confirmação/);
  });

  it("cancelamento tem mensagem própria", () => {
    expect(oauthErrorMessage("access_denied")).toMatch(/cancelado/);
  });

  it("código desconhecido vira mensagem genérica (nunca ecoa o parâmetro da URL)", () => {
    const msg = oauthErrorMessage("<script>alert(1)</script>");
    expect(msg).toBe("Não foi possível entrar com o Google. Tente novamente.");
  });
});
