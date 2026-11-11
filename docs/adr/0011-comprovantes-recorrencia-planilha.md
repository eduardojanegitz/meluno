# ADR 0011: Comprovantes, despesas recorrentes, planilha e categorias aprendidas

- Status: aceito
- Data: 2026-11-11

## Foto do comprovante

**Armazenamento:** tabela `expense_receipt` no próprio Postgres (`bytea`), uma foto por despesa.

- **Por quê:** não exige criar conta nem chaves em outro serviço para lançar.
- **Custo:** cada foto ocupa cerca de 200 a 500 KB do banco. No plano gratuito do Neon (0,5 GB), isso dá alguns milhares de fotos.
- **Para crescer:** o acesso fica isolado em `services/receipts.ts` (gravar, ler, remover). Trocar por R2 ou S3 é reimplementar essas funções e migrar as linhas existentes. A coluna antiga `expense.receiptKey` continua reservada para isso.

**Fluxo:**
1. O navegador reduz a foto para no máximo 1600 px e a reencoda em JPEG (≤ 1,4 MB).
2. A foto vai por `PUT /api/grupos/:g/despesas/:e/comprovante`.
3. O servidor:
   - lê o corpo com limite de 1,5 MB (sem confiar no `Content-Length`);
   - aceita **só JPEG**;
   - **remove os metadados** (APP1–APP15 e COM: EXIF com GPS, XMP, IPTC, comentários) sem decodificar a imagem (`domain/jpeg.ts`), porque não confia no navegador.

**Permissões:**
- **Ver:** membros do grupo. Não membro recebe 404.
- **Anexar, trocar ou remover:** quem lançou, quem pagou ou um administrador, em grupo não arquivado.
- **Resposta:** `Cache-Control: private, max-age=300`, `Content-Disposition: inline`, tipo fixo `image/jpeg` com `nosniff` global.

**CSRF:** Route Handlers não têm a verificação de origem das Server Actions. PUT e DELETE conferem `Origin` contra `Host`, além do cookie `SameSite=Lax`.

**Banco:** CHECKs de tamanho (1 a 1,5 MB e igual ao do conteúdo) e de tipo (`image/jpeg`).

**Ciclo de vida:** a foto é apagada junto com a despesa (cascade na exclusão definitiva; na exclusão lógica ela continua, para poder restaurar). Ela fica fora da exportação de dados pessoais, porque é registro do grupo.

## Despesas recorrentes

- **Criação:** no formulário, "Repetir: toda semana / todo mês". Só ao criar, e não vale para divisão por item.
- **Modelo:** a despesa salva é a 1ª ocorrência e cria um `recurring_expense` (pagadores e divisão guardados como vieram do formulário) na mesma transação.
- **Datas:** semanal soma 7 dias. Mensal repete o dia do mês; 29, 30 e 31 caem no último dia dos meses curtos e voltam ao dia original (31/jan → 28/fev → 31/mar). O "hoje" é calculado no fuso de Brasília.
- **Geração:** `GET /api/cron/recorrentes`, todo dia às 06h de Brasília, protegida por `CRON_SECRET`.
  - Cada ocorrência passa pelo **mesmo `createExpense`** do formulário: validações, histórico, notificações e push.
  - Quem "lança" é quem criou a recorrência.
- **Sem duplicar:** o id da ocorrência é derivado de (modelo, data). Há também um índice único `(recurringExpenseId, date)`.
- **Atraso:** se o agendador ficar parado, recupera até 12 ocorrências por modelo em cada execução.
- **Pausa automática**, com aviso por notificação para quem criou:
  - alguém da divisão saiu do grupo;
  - o grupo foi arquivado;
  - quem criou saiu.
- **Gerenciar** (Configurações do grupo → Despesas recorrentes):
  - pausar e retomar. Retomar **pula as datas perdidas** e não lança atrasados de uma vez;
  - excluir: as despesas já lançadas continuam;
  - só quem criou ou um administrador.
- **Editar uma ocorrência não altera o modelo.** Para mudar valor ou divisão, exclua a recorrência e crie de novo.

*Decisões técnicas revisáveis:* pular datas perdidas ao retomar, o limite de 12 ocorrências por execução e a regra de quem "lança" a ocorrência.

## Planilha do grupo

`GET /api/grupos/:g/exportar` (Configurações → Planilha), em CSV para o Excel brasileiro:
- separador `;`, vírgula decimal, UTF-8 com BOM e CRLF;
- uma linha por despesa e por acerto;
- **uma coluna por pessoa:** a parte dela na despesa, ou +/− no acerto.

**Proteção contra injeção de fórmulas:** texto que começa com `= + - @` ganha `'` na frente. Os valores numéricos vão sem escape. Só para membros, 20 exportações por hora.

## Categoria aprendida

O formulário recebe, das 200 despesas mais recentes do grupo, a última categoria usada para cada descrição (normalizada, sem acento, caixa ou espaços extras). Ela vence a sugestão por palavras-chave. A pessoa continua podendo trocar.
