# ADR 0014: Despesas em outra moeda

- Status: aceito
- Data: 2026-11-11

## Regra

- **A conta do grupo continua numa moeda só.** Uma despesa paga em outra moeda guarda:
  - o **valor original** e a **moeda original**;
  - a **cotação usada**: unidades da moeda do grupo por 1 da original.
- O valor convertido (`amountMinor`, na moeda do grupo) é o que entra em divisão, saldos, acertos, gráficos e planilha. Nada mudou no cálculo das dívidas.
- **Conversão:** `original × cotação`, respeitando as casas de cada moeda (iene e peso chileno sem centavos), arredondada meio para cima no centavo.
  - Ex.: US$ 50,00 × 5,5517 = R$ 277,585, que fica R$ 277,59.
- **Cotação exata:** guardada como inteiro (`exchangeRateE10` = cotação × 10¹⁰), com aritmética em `BigInt`. Nenhum ponto flutuante no caminho do dinheiro.
- **O servidor refaz a conversão** e recusa a despesa se o convertido enviado não bater.
- **O banco exige coerência:** os três campos juntos ou nenhum; moeda original diferente da do grupo; valores positivos. A primeira versão desse CHECK deixava passar campos pela metade, porque em SQL `NULL > 0` é "desconhecido". Uma segunda migration exige cada campo explicitamente.

## Cotação sugerida

- **Fonte:** referência do Banco Central Europeu, via Frankfurter (`api.frankfurter.dev`, gratuito e sem chave). Endereço fixo, então não há risco de SSRF.
- **Privacidade:** só saem as **moedas e a data**, nenhum dado pessoal.
- **Detalhes:**
  - fim de semana e feriado usam o último dia útil;
  - cache de 12 h;
  - 60 consultas por hora por pessoa;
  - se o serviço falhar, a pessoa digita a cotação.
- **Moedas sem referência do BCE** (ARS, CLP, UYU, PYG, COP, PEN): só cotação digitada, com aviso.
- **A sugestão nunca sobrescreve o que a pessoa digitou**, como a cotação do cartão com IOF ou da casa de câmbio. O teste E2E pegou um bug aqui: a resposta chegava depois e apagava valor e cotação. Ele foi corrigido com atualização funcional do estado e um ref para "já digitou".

## Limites (decisões revisáveis)

- **Divisão por item** só na moeda do grupo. A nota fiscal (NFC-e) é sempre em real.
- **Recorrência** não vale para despesa em outra moeda: a cotação muda, e repetir a mesma daria valores errados.
- **Valores por pessoa ("Valores")** são digitados na moeda do grupo.
- Não guardamos histórico de cotações nem convertemos grupos inteiros de moeda.

## Onde aparece

- **Formulário:** "Paguei em outra moeda" abre moeda, valor pago e cotação. O total do grupo aparece convertido, e a prévia da divisão usa o convertido.
- **Lista:** "R$ 277,59 (US$ 50,00)".
- **Detalhe:** "Pago US$ 50,00 · cotação 5,5517 BRL por USD".
- **Planilha:** colunas Moeda original, Valor original e Cotação.
