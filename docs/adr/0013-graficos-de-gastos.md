# ADR 0013: Gráficos de gastos do grupo

- Status: aceito
- Data: 2026-11-11

## O que mostra

A aba **Gastos** do grupo, com filtro de período (este mês, 3 meses, este ano, tudo), mostra:

- **Números de destaque:** total do grupo, número de despesas, sua parte e a maior categoria.
- **Por mês:** colunas, só quando o período tem 2 meses ou mais. Meses sem gasto aparecem, e o gráfico mostra no máximo os 12 últimos.
- **Por categoria e por pessoa:** lista com barra, do maior para o menor, com valor e %. Por pessoa, a medida é a **parte** (o que consumiu), com "pagou … nas despesas" ao lado.
- **Tabela:** os mesmos números em tabela, por "Ver como tabela".

**Acertos não entram**, porque são devolução entre as pessoas e não gasto. Só despesas não excluídas, com data até hoje (fuso de Brasília). Despesas recorrentes futuras ficam de fora.

## Escolhas de visualização (guia de dataviz)

- **Forma:** a tarefa é comparar tamanhos.
  - Categorias e pessoas usam barras ranqueadas numa cor só. Não usei pizza: barras numa mesma base comparam melhor, e o número fica escrito.
  - Meses usam colunas.
- **Cor:** um tom só, `--chart-1`, que é verde do app e não o verde de status "a receber".
  - **Validado** com o script do guia: claro `#1f9466` e escuro `#2ba673`, os dois com contraste ≥ 3:1 no cartão e dentro da faixa de luminosidade do modo.
  - O verde-menta da marca (`#7ee8b5`) **falhou** no escuro, por ser claro demais, e por isso não é usado nos gráficos.
- **Marcas:** coluna com no máximo 24 px, ponta de cima arredondada em 4 px e base reta. Barras das listas com 8 px. Uma só linha de base, discreta.
- **Rótulos:** valor escrito só na coluna do maior mês. Os demais aparecem ao tocar ou focar (a área de toque é a faixa inteira) e na tabela. Texto sempre na cor de texto, nunca na cor da barra.
- **Filtro:** uma linha acima de tudo. Ao trocar o período, o quadro anterior fica mais apagado até chegar o novo, sem esqueleto nem salto.
- **Acessibilidade:** colunas com `aria-label`, valor lido via `aria-live`, tabela alternativa. Verificado com axe em claro e escuro (E2E).

## Dados

- `domain/spending.ts`: agregação pura. Um teste de propriedade garante que categorias, meses, partes e pagamentos **sempre somam o total**.
- `services/spending.ts`: só membros, calculado no servidor a cada troca de período. Ele vem por action quando a aba abre, então não pesa o carregamento da página do grupo.
