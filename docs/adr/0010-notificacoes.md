# ADR 0010: Notificações por e-mail, push e resumo semanal

- Status: aceito
- Data: 2026-11-11

## Entrega

- As notificações continuam sendo gravadas **dentro da transação** que as gera (`notifyGroup`, convites).
- Logo depois, `scheduleDelivery(ids)` agenda a entrega com `after()` do Next, que roda depois da resposta. A entrega **relê as linhas pelo id**: se a transação foi desfeita, elas não existem e nada é enviado. Não é preciso mexer em cada serviço nem mandar nada antes do commit.
- É **melhor esforço**: falha de e-mail ou push vai para o log e não é repetida. A notificação sempre aparece em Atividade.
  - Se precisar de garantia, o próximo passo é uma coluna `deliveredAt` e um agendador que reenvia as pendentes.
- Fora de uma requisição (testes, scripts), `after()` não existe: `scheduleDelivery` ignora, e os testes chamam `deliverNotifications` direto.

## E-mail

| Tipo | Preferência | Padrão |
|---|---|---|
| Despesa nova que inclui a pessoa | `emailOnExpense` | desligado |
| Pagamento registrado, a confirmar, confirmado ou recusado | `emailOnSettlement` | ligado |
| Convite, lembrete de pagamento | — | já mandam o próprio e-mail no fluxo de origem |

- Só vai para e-mail confirmado.
- Cada interruptor salva na hora (`updateNotificationPrefsAction`).
- O "Salvar perfil" não envia mais essas preferências: antes ele mandava os valores carregados ao abrir a página e podia desfazer um ajuste feito depois.

## Push (Web Push com VAPID, biblioteca `web-push`)

- **Service worker** (`public/sw.js`): só `push` e `notificationclick`. **Continua sem cache offline nem handler de `fetch`** (ADR 0002). O clique só abre caminhos do próprio app.
- **Inscrição:**
  - uma por navegador ou aparelho (`push_subscription`, endpoint único);
  - se outra conta usou o aparelho antes, a inscrição passa para quem está logado;
  - no máximo 10 aparelhos por pessoa;
  - **ao sair da conta**, a inscrição do aparelho é removida;
  - inscrição que o serviço de push diz não existir mais (404/410) é apagada no envio.
- **Anti-SSRF:** o servidor faz requisições para o endpoint que o navegador informa, então só aceitamos os serviços oficiais por HTTPS, sem porta: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com` e `*.notify.windows.com`.
- **iPhone:** push só funciona com o app instalado na tela inicial (iOS 16.4+). Fora disso, o Perfil explica como fazer.
- **Conteúdo:** o mesmo texto da tela de Atividade (`src/lib/notification-message.ts`), com título (nome do grupo), corpo e caminho. O payload vai criptografado de ponta a ponta até o navegador.
- **Sem configuração:** sem `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, a opção não aparece e nada é enviado.

## Resumo semanal

- Opt-in (`emailWeeklySummary`): saldo em aberto de cada grupo ativo, separado por moeda, via `getDashboard`.
- Rota `GET /api/cron/resumo-semanal`:
  - exige `Authorization: Bearer CRON_SECRET`, com comparação em tempo constante;
  - sem segredo configurado, responde 503.
- **Agendamento** (`vercel.json`): **todo dia às 08h de Brasília**.
  - O plano Hobby da Vercel só permite agendamentos diários.
  - Cada pessoa recebe se o último resumo tiver mais de 6 dias, então o envio é semanal por pessoa.
  - Lotes de 200 por execução (cabe em 60 s); quem não coube vai no dia seguinte.
- **Sem duplicar:** cada pessoa é "reservada" com um `UPDATE` condicional antes do envio, então duas execuções simultâneas não mandam duas vezes.
- Quem não tem saldo em aberto não recebe nada naquela semana.

## LGPD

- A exportação inclui os aparelhos com push, só o nome e as datas. O endpoint fica de fora, porque funciona como credencial de envio.
- A exclusão de conta apaga as inscrições em cascata.
- A política de privacidade cita o serviço de push do navegador como operador.
