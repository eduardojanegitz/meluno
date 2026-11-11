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
    domain/            regras financeiras puras (Etapa 4)
    services/          casos de uso com autorização e transações (Etapa 4)
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
