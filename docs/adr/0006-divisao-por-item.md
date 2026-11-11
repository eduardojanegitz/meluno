# ADR 0006: Divisão por item

- Status: aceito
- Data: 2026-11-11

## Regra

1. Cada item é dividido **igualmente** entre quem o consumiu. Usa o maior resto (Hamilton), com semente `despesa:item<i>`.
2. **Serviço** = itens × taxa, arredondado **meio-para-cima** no centavo. A taxa vai de 0% a 30% e o padrão é 10%.
3. **Taxas fixas** (entrega, couvert…) são somadas ao serviço.
4. Serviço e taxas são rateados **na proporção do consumo** de cada pessoa. Usa o maior resto com peso = consumo e semente `despesa:extras`.
5. **Total** = itens + serviço + taxas.
   - O total é calculado: o servidor recalcula tudo e recusa a despesa se o total enviado for diferente.
   - Os pagadores precisam somar esse total.

Quem não consumiu nenhum item não paga nada, nem serviço. A soma das partes é sempre exatamente o total. Há um teste de propriedade com 300 casos aleatórios, e ele também verifica que ninguém paga menos do que consumiu.

## Persistência

- **O que fica gravado:**
  - `expense_item` (posição, nome, valor) e `expense_item_member` (quem consumiu);
  - `serviceBp` e `feesMinor` na própria despesa;
  - o valor final de cada pessoa continua em `expense_split`.

  Saldos, simplificação e acertos não mudaram nada.
- **Restrições no banco:**
  - itens com valor > 0 e ≤ 10 milhões;
  - no máximo 60 itens;
  - serviço entre 0 e 3000 pontos-base;
  - taxas ≥ 0;
  - coerência: `serviceBp` e `feesMinor` existem **só e sempre** em despesas `ITEMS`.
- **Edição:** apaga e recria os itens. O snapshot do histórico inclui itens, serviço e taxas.

## Ambiente de desenvolvimento

O cliente Prisma em cache no `globalThis`, que evita abrir conexões a cada HMR, passou a ser recriado quando a classe gerada muda. Isso acontece depois de `prisma generate`. Antes, o servidor de desenvolvimento continuava com o cliente antigo até reiniciar, e falhava ao usar tabelas novas (lembretes, itens).

## Pendência conhecida (resolvida na ADR 0009)

Testes que criam despesas mostram o aviso do `pg` "client.query() when the client is already executing a query". A origem provável é a criação aninhada (pagadores, divisões e itens numa única chamada `create`) executada pelo Prisma 7. Ainda não está confirmado. O aviso não afeta o resultado hoje, mas vira erro no `pg@9`. Investigar antes de atualizar o `pg`.
