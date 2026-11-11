# ADR 0004: Segurança e LGPD

- Status: aceito
- Data: 2026-11-11

## Modelo de autorização

- Toda Server Action passa por `authedAction`. Ele valida a sessão no servidor, valida a entrada com Zod e converte erros sem vazar detalhes internos.
- Os services exigem associação **ativa** ao grupo (`requireMember`/`requireAdmin`). Recurso de grupo alheio responde `NOT_FOUND`, nunca `FORBIDDEN`, para não revelar que ele existe.
- O `proxy.ts` só faz o redirecionamento otimista, olhando se o cookie existe. Ele **não** é a barreira de segurança.
- A proteção contra CSRF vem das Server Actions do Next, que conferem a origem da requisição, e do Better Auth, que confere `trustedOrigins`.

## Rate limit

Os limites ficam no banco (tabela `rate_limit`) e valem mesmo com várias instâncias do servidor.

| Ação | Limite |
|---|---|
| Login | 5/min |
| Cadastro | 10/h |
| Redefinir senha | 5/h |
| Reenviar verificação | 3 a cada 10 min |
| Criar despesa | 120/h |
| Criar acerto | 60/h |
| Criar grupo | 20/h |
| Adicionar pessoa | 60/h |
| Convite (criar) | 30/h |
| Convite (aceitar) | 30/h |
| Chave Pix | 20/h |
| Excluir conta | 5/h |

## Cabeçalhos HTTP (`next.config.ts`)

- **CSP sem nonce.** Nonces exigem renderização totalmente dinâmica e são incompatíveis com o Partial Prerendering que o app usa.
  - `script-src` aceita `'unsafe-inline'`, necessário para o bootstrap do Next e o script anti-flash de tema.
  - Todo o resto fica restrito a `'self'`: `connect-src`, `form-action`, `frame-ancestors 'none'`, `object-src 'none'`.
  - Imagens externas: só avatares do Google.
- **Outros cabeçalhos:** HSTS (só em produção), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` restritiva.
- **Tokens na URL.** Links de convite levam o token no caminho. A política de referrer impede que o caminho vá para outros sites, e o banco guarda só o hash SHA-256 do token.
- **Limite conhecido.** O `'unsafe-inline'` enfraquece a defesa contra XSS. A mitigação principal é o React escapar a saída: não há `dangerouslySetInnerHTML` com dado de usuário, e os templates de e-mail usam `escapeHtml`. Revisitar quando houver CSP por hash compatível com PPR (SRI experimental do Next).

## Sessão revogada

Uma sessão revogada no servidor (por exemplo, na redefinição de senha) pode deixar o cookie no navegador. Nesse caso, `requireViewer` redireciona para `/entrar?sessao=expirada`, e o proxy não devolve esse acesso para `/inicio`. Isso evita um laço de redirecionamento.

## LGPD: exclusão de conta (complementa a ADR 0001 §7)

### Reautenticação
- Conta com senha: exige a senha.
- Conta só com Google: exige login feito há menos de 15 minutos.
- Nos dois casos, a pessoa também digita `EXCLUIR`.

### O que acontece, numa única transação com lock dos grupos afetados
- **Nos grupos:** o membro vira "Usuário removido", com status `LEFT`, sem e-mail e com papel `MEMBER`.
- **Registros financeiros:** são preservados, porque compõem os saldos das outras pessoas. Saldo em aberto **não** é perdoado.
- **Administração:** se a pessoa era a única administradora ativa, o membro ativo mais antigo é promovido. *Decisão técnica para não deixar grupo sem administrador; revisável.*
- **Grupo vazio:** se não sobra nenhum membro ativo, o grupo é arquivado.
- **Nome nos registros:** sai dos payloads de atividade sobre a pessoa e das notificações de outras pessoas que a citam.
- **E-mail:** convites para o e-mail da pessoa são apagados, e o e-mail é removido de membros provisórios.
- **Tokens e rate limit:** tokens de verificação e contadores de rate limit da pessoa são apagados.
- **Usuário:** a linha do usuário é excluída. Sessões, contas de login, chaves Pix, preferências e notificações saem em cascata.

### O que permanece
Descrições e observações de despesas escritas pela pessoa continuam. Elas fazem parte do registro financeiro do grupo.

## Ainda não implementado (fora do MVP)

- ~~Política de privacidade e termos de uso~~ e ~~exportação dos dados pessoais~~: feitos na ADR 0009. Os textos ainda precisam de revisão jurídica.
- Alerta por e-mail de login em dispositivo novo.
- 2FA.
