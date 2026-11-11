/**
 * Mensagens para o `?error=` que o Better Auth anexa ao voltar do Google.
 * Retorna null para "sem erro"; códigos desconhecidos viram uma mensagem genérica.
 */
const messages: Record<string, string> = {
  // A pessoa fechou ou recusou a tela do Google.
  access_denied: "Login com Google cancelado. Tente de novo quando quiser.",
  // Já existe conta com esse e-mail, mas o e-mail dela ainda não foi confirmado.
  // Vincular agora deixaria quem criou a senha entrar na conta de quem é o dono do e-mail.
  account_not_linked:
    "Já existe uma conta com esse e-mail esperando confirmação. Abra o link que enviamos por e-mail (ou entre com a senha) e depois conecte o Google no Perfil.",
  account_already_linked_to_different_user: "Essa conta Google já está conectada a outro usuário do Meluno.",
  email_does_not_match: "Use a conta Google com o mesmo e-mail do seu cadastro no Meluno.",
  email_not_verified: "Seu e-mail no Google não está verificado. Verifique-o no Google e tente de novo.",
  unable_to_link_account: "Não foi possível conectar a conta Google. Entre de novo e tente outra vez.",
};

export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return messages[code] ?? "Não foi possível entrar com o Google. Tente novamente.";
}
