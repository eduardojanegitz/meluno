# ADR 0003 — Motor financeiro e consistência

- Status: aceito
- Data: 2026-11-10

## Motor de divisão (`src/server/domain`)

- Código puro (sem I/O), compartilhado entre servidor e cliente. O formulário
  usa **a mesma função** para a prévia que o servidor usa para gravar.
- Igual, percentual e por partes: método do maior resto sobre pesos inteiros
  (BigInt nos produtos). Personalizado: soma precisa ser exata.
- Desempate do centavo: hash FNV-1a de `idDaDespesa:idDoMembro` (alterna entre
  despesas, determinístico para a mesma despesa).

## Id da despesa gerado no cliente

O id (UUID) é gerado no navegador ao abrir o formulário e enviado na criação. Ele:

1. é a **semente do arredondamento** — a prévia exibida é exatamente o que é gravado;
2. funciona como **chave de idempotência** — reenvios/duplo toque não duplicam.

Se o id já existir e pertencer a outra pessoa, a criação é recusada (CONFLICT).

## Simplificação de dívidas

- Até 12 pessoas com saldo ≠ 0: partição ótima em subconjuntos de soma zero
  (programação dinâmica O(2ⁿ·n)) — **garante o mínimo de transferências**.
- Acima disso: guloso com pré-passe de pares idênticos — **não garante o mínimo**
  (há contraexemplo nos testes: guloso 5, ótimo 4), mas nunca passa de n − 1.
- Sem simplificação: dívidas por par, rateando a parte de cada participante
  entre os pagadores proporcionalmente.

## Concorrência

- Toda escrita financeira de um grupo faz `SELECT … FOR UPDATE` na linha do grupo
  (serializa operações do mesmo grupo; grupos diferentes não se bloqueiam).
- Edição de despesa usa lock otimista (`version`): versão desatualizada → CONFLICT.
- Dentro de transações interativas, consultas são sequenciais (uma conexão).

## Estado de formulários (Next 16)

O Next preserva o estado de páginas visitadas (React Activity). Formulários de
criação/edição são remontados (`key`) após salvar, para nunca reaproveitar id,
versão ou campos de um envio anterior.
