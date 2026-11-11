# ADR 0009: Preparação para o lançamento

- Status: aceito
- Data: 2026-11-11

## Aviso do `pg` (pendência do ADR 0006)

**Causa:** com `include` de várias relações (pagadores, divisões, itens…), o Prisma 7 dispara as consultas das relações **em paralelo**. Dentro de `$transaction` há uma única conexão. O `pg@8` aceita e enfileira, mas avisa, e no `pg@9` isso vira erro.

**Correção:**
- `withParts` (em `services/expenses.ts`) carrega as partes da despesa uma consulta por vez.
- As quatro leituras com `include` dentro de transações passaram a usá-lo: criar, carregar para editar, depois de editar e detalhe.

**Por que não `relationLoadStrategy: "join"`:** ainda é preview (`relationJoins`) no Prisma 7.10 e mudaria todas as consultas do app, inclusive as do Better Auth.

**Regra daqui em diante:** dentro de transação, não usar `include`/`select` com mais de uma relação. A suíte de integração roda sem nenhum aviso; manter assim.

## Cidade no Pix

- `user_preferences.pixCity` (até 40 caracteres), editada em Perfil → Dados.
- Vai no campo 60 do BR Code (normalizada para 15 caracteres, sem acento, em maiúsculas). Vazia continua "BRASIL".
- Chega a quem paga junto com as chaves (`getMemberPixKeys`) e também entra no lembrete de cobrança.

## Exportação dos dados (portabilidade, LGPD art. 18, V)

`GET /api/conta/exportar`, em Perfil → Privacidade → "Baixar meus dados". Devolve um JSON para download.

- **Entra:**
  - conta;
  - formas de login (só o tipo e a data);
  - sessões (data, IP, navegador);
  - preferências e chaves Pix;
  - participações em grupos;
  - em cada despesa, o total, **quanto a pessoa pagou e a parte dela**;
  - acertos em que ela está, com o nome da outra pessoa;
  - notificações.
- **Não entra:**
  - hash de senha e tokens (sessão, OAuth);
  - e-mails de outras pessoas;
  - a parte dos outros nas despesas.

  De terceiros, só o nome de exibição necessário para entender o registro.
- **Proteção:** só com sessão válida, no máximo 5 exportações por hora, `Cache-Control: no-store`. Uma página de outro site até consegue disparar o download, mas não consegue ler a resposta.

## Política de privacidade e termos

- Páginas públicas `/privacidade` e `/termos`, escritas a partir do que o app faz de verdade (dados, operadores, retenção, exclusão, direitos).
- **Ligadas** no rodapé da landing, no cadastro (inclusive pelo Google), no login e no Perfil.
- **Dados do responsável** ficam em `src/lib/legal.ts`. Enquanto houver campo entre colchetes, as páginas mostram um aviso de **rascunho**.

**Decisões de negócio que entraram no texto e precisam ser confirmadas:**
- público a partir de 18 anos;
- resposta a pedidos de dados em até 15 dias;
- aviso no app antes de mudanças importantes valerem;
- foro.

**Não implementado:** guarda de registros de acesso por 6 meses (Marco Civil da Internet, art. 15). A obrigação vale para provedor de aplicação constituído como pessoa jurídica com fins econômicos. Hoje as sessões são apagadas ao sair ou expirar, e o texto da política não promete essa guarda. Se o Meluno for operado por uma empresa, criar o registro de acessos (IP, data e hora) com retenção de 6 meses.

O texto **não substitui revisão jurídica**.

## Deploy

O guia (Vercel + Neon + Resend) está no README e ganhou um checklist de lançamento: dados legais, região São Paulo (a SEFAZ às vezes recusa acesso de fora do país), domínio, publicação do OAuth no Google, domínio no Resend e um roteiro de teste no celular.
