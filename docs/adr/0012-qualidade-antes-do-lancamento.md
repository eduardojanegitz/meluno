# ADR 0012: Qualidade antes do lançamento

- Status: aceito
- Data: 2026-11-11

## Testes de ponta a ponta (Playwright)

- **Contra o build de produção** (`next start`, porta 3100), num banco próprio `meluno_e2e`. O `global-setup` cria o banco, aplica as migrations, zera as tabelas e cria pessoas de teste com e-mail confirmado.
- **Sem e-mail:** `EMAIL_DISABLED=true`. Só vale para isso: dispensa a chave do Resend e não envia nada.
- **Celular emulado** (Pixel 7, pt-BR, fuso de São Paulo).
- **Uma sessão por pessoa** (`auth.setup.ts`), reaproveitada pelos testes. O app limita 5 logins por minuto e o limite continua ligado no E2E.
- **Fluxo principal**, com duas pessoas:
  1. criar grupo e convidar por link; a outra pessoa entra;
  2. cadastrar chave Pix;
  3. lançar despesa e **anexar a foto do comprovante** (compressão, envio, limpeza no servidor e exibição);
  4. pagar com Pix (Copia e Cola com `br.gov.bcb.pix`) e confirmar o recebimento: "Tudo quite!".
- **Também cobertos:**
  - quem não é do grupo não vê nada dele, nem a planilha;
  - senha errada;
  - páginas públicas;
  - baixar os dados e excluir a conta;
  - o endpoint de erros do navegador.
- **Status 404 com streaming:** a página de grupo alheio responde **200 com a tela de "não encontrado"**. Com o carregamento em partes, o status já foi enviado quando o `notFound()` acontece. O teste confere o que importa: nada do grupo aparece.
- **Na CI:** job `e2e`, depois do `check`, com Postgres e Chromium. O relatório vai como artefato quando falha.

## Acessibilidade (axe, WCAG 2.1 A/AA)

- Telas públicas e logadas, em **claro e escuro**, mais as telas de grupo com dados: lista, saldos, nova despesa, configurações e detalhe com comprovante.
- O teste falha em problemas "serious" e "critical".
- **Corrigido:**
  - contraste das abas inativas do grupo (`text-foreground/60` → `text-muted-foreground`);
  - o "R$ 0,00" vazio do campo de valor (`/70` de opacidade removido).

## Desempenho no celular

- **Método:** LCP e CLS medidos com CPU 4x mais lenta e rede "4G lenta", como no Lighthouse mobile.
- **Limites:** LCP ≤ 4 s e CLS ≤ 0,1.
- **Resultado:** todas as telas entre 1,2 e 1,9 s, com CLS ≤ 0,02.
- **Corrigido:**
  - **`/entrar` caiu de 3,1 s para 1,25 s.** O maior texto da tela (o aviso legal do Google) estava dentro do formulário, que só aparece depois do JavaScript; agora vem no HTML.
  - As telas de autenticação ganharam um fallback com o título e o contorno do formulário, em vez de ficarem em branco até hidratar.

## Erros em produção

- **Servidor:** `instrumentation.ts` → `onRequestError` → `reportError`. Registra:
  - a rota no formato padrão (`/grupos/[groupId]`, sem ids);
  - o método, o tipo e o `digest`;
  - o nome e a mensagem **com dados pessoais removidos** (`lib/scrub.ts`: e-mails, UUIDs, tokens, sequências de dígitos).
- **Navegador:** `error.tsx` e `global-error.tsx` em pt-BR, com o código do erro, enviam para `POST /api/erros`. O endpoint só aceita a própria origem e limita 30 envios a cada 10 minutos por IP.
- **Destino:**
  - sempre o log estruturado, que a Vercel guarda e onde dá para criar alertas;
  - opcionalmente `ERROR_WEBHOOK_URL` (Slack, Discord ou coletor próprio), com o mesmo resumo.
- **Por que não Sentry agora:** exigiria conta, chave e enviar dados a mais um operador. Se for adotado, ele entra no lugar do webhook em `reportError`, com o mesmo cuidado de não enviar dados pessoais.
- **Página 404 própria** em pt-BR. Ela também serve para recursos de outros grupos, sem revelar se eles existem.

## Ambiente de desenvolvimento

- **Cliente do Prisma desatualizado (a pendência da Etapa 14):** não consegui reproduzir num servidor novo. Lá o `prisma generate` foi percebido na hora; o caso anterior foi um servidor antigo em estado ruim.
- **Mudança:** agora, em desenvolvimento, pedir um modelo que o cliente carregado não conhece gera um erro claro ("rode `npx prisma generate` e reinicie o `npm run dev`") em vez de "Cannot read properties of undefined". Isso é feito com um Proxy só em desenvolvimento, que repassa os métodos ao cliente original.
