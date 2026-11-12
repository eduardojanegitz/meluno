# meluno.

> Compartilhe momentos. Não complicações.

Plataforma para dividir despesas compartilhadas entre amigos, casais, famílias e grupos de viagem.

## Requisitos

- Node.js 22.12+ (desenvolvido com Node 24)
- Docker (Postgres local)

## Primeiros passos

```bash
cp .env.example .env          # gere BETTER_AUTH_SECRET com: openssl rand -base64 32
npm install                   # também gera o Prisma Client
npm run db:up                 # Postgres 17 em localhost:5432 (bancos meluno e meluno_test)
npm run db:migrate            # aplica as migrations
npm run dev                   # http://localhost:3000
```

Em desenvolvimento, sem `RESEND_API_KEY`, os e-mails (confirmação de conta, redefinição de senha) são **impressos no terminal** do `npm run dev` — copie o link de lá. Em produção a chave é obrigatória e o build falha sem ela.

O login com Google aparece automaticamente quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão definidos (callback: `{APP_URL}/api/auth/callback/google`).

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run check` | Typecheck + lint + todos os testes |
| `npm run test:unit` | Testes unitários (`src/**/*.test.ts`) |
| `npm run test:integration` | Testes contra o Postgres de teste (`meluno_test`) |
| `npm run db:migrate` | Cria/aplica migrations em desenvolvimento |
| `npm run db:studio` | Prisma Studio |
| `npm run build:deploy` | Aplica migrations pendentes e gera o build (usado no deploy) |
| `npm run test:e2e` | Build de produção + testes de ponta a ponta no navegador (Playwright, celular emulado), com acessibilidade (axe) e desempenho (LCP/CLS). Usa o banco `meluno_e2e` e não envia e-mails |
| `npm run test:e2e:only` | Os mesmos testes, sem refazer o build |

## Estrutura

```
src/
  app/                 rotas (App Router) — (auth), (app), api/auth, design (vitrine, só em dev)
  components/          ui/ (primitivos shadcn customizados) + componentes de produto
  lib/                 formatação, env, utilitários sem I/O
  schemas/             schemas Zod compartilhados cliente/servidor
  server/
    auth/              Better Auth + sessão
    actions/           wrapper de Server Actions (sessão, validação, erros)
    domain/            regras financeiras puras
    services/          casos de uso com autorização e transações
    email/  db.ts  errors.ts  logger.ts
prisma/                schema e migrations (com CHECK constraints financeiras)
tests/                 integração e utilitários de teste
docs/adr/              decisões de produto e arquitetura
```

## Princípios

- Dinheiro sempre em **centavos inteiros** (`amountMinor`) + moeda ISO 4217. Nunca `float`.
- Saldos são **derivados** de despesas e acertos; nada de saldo armazenado.
- Toda leitura/escrita passa por autorização no servidor; recursos de outros grupos respondem como inexistentes.
- Detalhes em [`docs/adr`](docs/adr).

## Deploy (Vercel + Neon + Resend)

1. **Banco (Neon, Postgres 17):** crie o projeto e copie duas URLs:
   - *pooled* → `DATABASE_URL` (usada pelo app);
   - *direct* → `DIRECT_DATABASE_URL` (usada só pelas migrations).
2. **E-mail (Resend):** verifique o domínio de envio e crie uma API key → `RESEND_API_KEY`.
   Ajuste `EMAIL_FROM` para um remetente desse domínio.
3. **Vercel:** importe o repositório e configure:
   - *Build Command:* `npm run build:deploy` (aplica migrations antes do build);
   - *Node.js:* 22 ou 24;
   - variáveis de ambiente (Production e Preview):

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | sim | URL *pooled* |
| `DIRECT_DATABASE_URL` | recomendada | URL direta, para migrations |
| `APP_URL` | sim | URL pública, sem barra final (links de e-mail e convites) |
| `BETTER_AUTH_SECRET` | sim | `openssl rand -base64 32` — **diferente** por ambiente |
| `RESEND_API_KEY` | sim em produção | o build falha sem ela |
| `EMAIL_FROM` | sim | remetente verificado no Resend |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | não | habilitam login com Google; callback `{APP_URL}/api/auth/callback/google` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | não | notificações push; `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | para recorrentes e resumo | protege `/api/cron/*` |
| `ERROR_WEBHOOK_URL` | não | webhook HTTPS que recebe um resumo de cada erro (sem dados pessoais) |

4. **Previews:** use uma *branch* do Neon por ambiente de preview, para que migrations de PRs não toquem o banco de produção.
5. **Depois do primeiro deploy:** crie uma conta, confirme o e-mail recebido e faça um fluxo completo (grupo → despesa → acerto).

A CI (`.github/workflows/ci.yml`) roda typecheck, lint, testes unitários e de integração contra um Postgres real, build de produção e `npm audit`.

### Checklist de lançamento

1. **Dados do responsável:** preencha `src/lib/legal.ts` (seu nome; confira o e-mail de contato e os provedores). Para uso gratuito por pessoa física, CPF não é necessário; se passar a cobrar, acrescente CPF/CNPJ e endereço. Enquanto houver campos entre colchetes, `/privacidade` e `/termos` mostram um aviso de rascunho. Revise os dois textos com um advogado.
2. **Região:** use a região de São Paulo na Vercel (`gru1`) e no Neon (`sa-east-1`).
   - Deixa o app mais rápido para quem está no Brasil.
   - Algumas SEFAZ recusam acesso de fora do país, o que afeta a leitura de NFC-e.
3. **Domínio:** aponte o domínio para a Vercel e use-o em `APP_URL`. HTTPS é obrigatório para instalar o app e usar a câmera.
4. **Google:**
   - na credencial OAuth, adicione `https://seu-dominio` (origem) e `https://seu-dominio/api/auth/callback/google` (redirecionamento);
   - na tela de consentimento, informe os links de `/privacidade` e `/termos`, verifique o domínio no Search Console e mude o público para "Em produção".
5. **Resend:** verifique o domínio de envio (registros DNS) e use um `EMAIL_FROM` desse domínio.
6. **Push e resumo semanal:**
   - gere as chaves com `npx web-push generate-vapid-keys` e configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (`mailto:` do contato);
   - crie `CRON_SECRET` (`openssl rand -base64 32`). A Vercel o envia sozinha para os dois agendamentos do `vercel.json`: despesas recorrentes às 06h e resumo semanal às 08h (Brasília);
   - sem as chaves, a opção de push não aparece no Perfil; sem o segredo, as rotas agendadas respondem 503 e **as despesas recorrentes não são lançadas**.
7. **Depois do deploy, no celular:**
   - criar conta e confirmar o e-mail;
   - entrar com Google;
   - instalar o app;
   - ler uma NFC-e real;
   - criar grupo, despesa e acerto;
   - ativar as notificações e usar "Enviar uma notificação de teste" (no iPhone, com o app instalado);
   - anexar a foto de um comprovante e baixar a planilha do grupo;
   - abrir o Pix Copia e Cola no app do banco;
   - baixar os dados e excluir uma conta de teste.

### Segurança em produção

- Cabeçalhos definidos em `next.config.ts`: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Cookies de sessão `Secure` + `HttpOnly` + `SameSite=Lax`; rate limit persistido no banco (funciona com várias instâncias).
- Detalhes e limites conhecidos em [`docs/adr/0004-seguranca-e-lgpd.md`](docs/adr/0004-seguranca-e-lgpd.md).
