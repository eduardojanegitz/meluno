# ADR 0005: Pix Copia e Cola, lembretes e encerramento de grupo

- Status: aceito
- Data: 2026-11-11

## Pix Copia e Cola (`src/lib/pix.ts`)

- Código **estático** BR Code (EMV-MPM), gerado localmente a partir da chave do recebedor. Não há PSP, integração bancária nem cobrança dinâmica. O Meluno continua sem movimentar dinheiro e sem saber se o pagamento ocorreu.
- **Campos preenchidos:**
  - chave;
  - valor exato da sugestão de acerto, formatado com aritmética inteira;
  - nome do recebedor, sem acentos, até 25 caracteres;
  - descrição "Meluno <grupo>";
  - txid `***`.
- **Cidade.** O padrão exige o campo, mas o Meluno não coleta cidade. Usamos "BRASIL", e os bancos não validam o valor. *Decisão técnica, revisável se algum banco recusar.*
- **Teste de conformidade.** Um teste reproduz byte a byte o exemplo do manual do Banco Central, inclusive o CRC16.
- **QR Code.** Gerado com `uqr` (sem dependências) e desenhado como um único `<path>`, sem `innerHTML`.
- **"Já paguei".** Cria um acerto **PENDENTE** (ADR 0001 §2). O saldo só muda quando quem recebe confirma.
- **Escopo.** Disponível apenas em grupos em BRL e quando o recebedor tem conta com chave Pix.

## Lembretes de cobrança (`src/server/services/reminders.ts`)

- **Quem pode cobrar:** só quem **recebe**, e só uma dívida que aparece agora nos acertos sugeridos (simplificados ou por par, conforme o grupo).
- **Limite:** **1 lembrete a cada 72 h por dupla** (quem recebe → quem deve), somando todos os canais e guardado em `payment_reminder`. Há também um rate limit de 30 por hora por pessoa.
- **E-mail:** é enviado pelo Meluno, junto com uma notificação no app.
  - Exige que a pessoa tenha conta e respeita `emailOnSettlement`.
  - O e-mail inclui o Pix Copia e Cola de quem cobra, quando existe.
- **WhatsApp:** o Meluno **não envia** mensagens. Abre `wa.me` com o texto pronto, incluindo o Pix de quem cobra, e a própria pessoa escolhe o contato e envia. O registro existe só para o limite.

## Encerrar grupo

- **Quem e quando:** só administradores, e só com **todos os saldos zerados**, verificado sob lock do grupo. Encerrar = arquivar: o grupo fica só para leitura.
- **Resumo antes de confirmar:** total gasto, número de despesas, quem mais pagou, categoria com mais gasto, período e número de acertos.
- **Arquivamento manual:** o arquivamento pelas configurações continua disponível sem exigir saldo zero, como antes.

## Celebração "Tudo quite!"

`createSettlement` e `confirmSettlement` retornam `groupSettled`, calculado na mesma transação. A interface só comemora quando isso é verdade.
