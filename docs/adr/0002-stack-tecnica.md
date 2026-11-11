# ADR 0002 — Stack técnica

- Status: aceito
- Data: 2026-11-10

| Área | Escolha | Motivo |
|---|---|---|
| Framework | Next.js 16 (App Router, Cache Components) + React 19 + TypeScript strict | Server Components reduzem JS no cliente; Server Actions com proteção de origem. |
| Estilo | Tailwind CSS v4 + shadcn/ui (base Radix) | Componentes copiados para o repositório, controle visual total, acessibilidade dos primitivos Radix. |
| Ícones | lucide-react | Traço consistente; nada de emoji como ícone. |
| Animação | motion | Animações de layout e suporte a `prefers-reduced-motion`. |
| Formulários | react-hook-form + zod | Mesmo schema no cliente e no servidor; servidor é a fonte da verdade. |
| Banco | PostgreSQL + Prisma | Relacional, transacional, tipado. |
| Auth | Better Auth | Auth.js passou a ser mantido pela equipe do Better Auth e o v5 segue em beta; Better Auth cobre e-mail/senha, verificação, reset, Google, sessões em banco e rate limit. |
| Infra (proposta) | Vercel + Neon + Resend + Cloudflare R2 | Docker local para desenvolvimento. |
| Testes | Vitest, fast-check, Playwright | Testes de propriedade para invariantes financeiras. |

## Dinheiro

Valores sempre em **centavos inteiros** (`amountMinor`), acompanhados do código ISO 4217 da moeda. Nenhum `float` no caminho financeiro.

## Camadas

`app/` → `server/actions` → `server/services` → `server/repositories`; `server/domain` é puro e não conhece Prisma nem Next.
