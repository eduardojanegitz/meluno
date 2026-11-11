# ADR 0007: Login com Google e instalação do app

- Status: aceito
- Data: 2026-11-11

## Login com Google

- **Ativação:** o botão só aparece quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão definidos. Sem eles, o app funciona só com e-mail e senha.
- **Escopos:** só o padrão do Better Auth (`openid email profile`). Não pedimos acesso a Drive, contatos ou agenda.
- **Contas novas:** quem entra pelo Google pela primeira vez ganha uma conta já confirmada (o Google só devolve e-mails verificados), sem senha.
- **Vinculação automática:** se já existe uma conta com o mesmo e-mail, o Google é conectado a ela, **desde que o e-mail local já esteja confirmado** (`requireLocalEmailVerified`).
  - Motivo: sem essa regra, alguém poderia criar uma conta com o e-mail de outra pessoa e esperar o dono entrar pelo Google. A conta passaria a ser "confirmada" e a senha do invasor continuaria valendo (pre-account takeover).
  - Nesse caso o retorno é `account_not_linked`, e a tela explica que é preciso confirmar o e-mail antes.
- **Conectar pelo Perfil:** a seção "Formas de entrar" permite conectar o Google a uma conta existente (`linkSocial`). Exige o mesmo e-mail do cadastro (`allowDifferentEmails: false`).
- **Criar senha:** contas só Google podem criar uma senha pelo fluxo de redefinição. O Better Auth cria a credencial quando ela não existe.
- **Erros do retorno:** o `?error=` é traduzido por uma lista fechada de mensagens (`src/lib/oauth-errors.ts`). O texto da URL nunca é exibido.
- **Exclusão de conta:** contas sem senha confirmam com uma sessão recente (já era assim desde o ADR 0004).

### Configuração (Google Cloud Console)

1. Crie um projeto e configure a tela de consentimento OAuth (tipo "Externo").
2. Em "Credenciais", crie um "ID do cliente OAuth" do tipo **Aplicativo da Web**.
3. Origens JavaScript autorizadas: a `APP_URL` (ex.: `http://localhost:3000`).
4. URIs de redirecionamento autorizados: `APP_URL` + `/api/auth/callback/google`.
5. Copie o ID e a chave secreta para o `.env`. Reinicie o servidor.

Enquanto o app estiver em modo "Teste" no console, só os e-mails cadastrados como testadores conseguem entrar.

## Instalação (PWA)

- **Android, Chrome/Edge no computador:** o navegador dispara `beforeinstallprompt`. Guardamos o evento (`src/lib/install.ts`) e o botão "Instalar" abre o diálogo nativo com um toque.
  - O ouvinte é registrado ao carregar os Providers, porque o evento chega antes de qualquer botão existir.
  - O evento só pode ser usado uma vez. Depois de aceito, Melu comemora e os botões somem.
- **iPhone/iPad:** o Safari não tem instalação programática. O botão abre um passo a passo (Compartilhar → Adicionar à Tela de Início → Adicionar). Em navegadores embutidos (Instagram, Facebook…) pedimos para abrir no Safari primeiro.
- **Já instalado** (`display-mode: standalone`) ou **navegador sem suporte** (Firefox, Safari no Mac): nenhum botão aparece. Não mostramos instruções que a pessoa não consegue seguir.
- **Onde aparece:**
  - landing (botão no topo);
  - Início (cartão que pode ser fechado e volta depois de 30 dias, guardado no `localStorage`);
  - Perfil (cartão fixo).
- **Sem service worker:** continua valendo o ADR 0002. Os critérios atuais de instalação do Chrome exigem só HTTPS e um manifesto válido, sem service worker. Em `localhost` o HTTPS não é exigido.
