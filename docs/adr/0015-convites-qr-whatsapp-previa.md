# ADR 0015: Convites com QR Code, WhatsApp e prévia do link

- Status: aceito
- Data: 2026-11-11

## Compartilhar

Depois de gerar o link (Configurações do grupo → Convidar pessoas), aparecem três botões:

- **WhatsApp:** `https://wa.me/?text=…`, com a mensagem pronta ("Entra no grupo “X” no Meluno pra gente dividir as despesas: <link>"). Abre o app no celular ou o WhatsApp Web.
- **QR Code:** o link em tela grande, para quem está do lado ler com a câmera. Usa o mesmo componente do QR do Pix (`components/qr-svg.tsx`), desenhado como um único `<path>`, sem `innerHTML`.
- **Enviar:** o menu de compartilhar do celular. Sem ele, copia o link.

## Página do convite sem login

- `/convites/<token>` saiu da área logada para o grupo de rotas `(public)`. **O endereço é o mesmo**, então os links já enviados continuam valendo.
- **Sem login:** mostra quem convidou, o nome do grupo e quantas pessoas há nele, com "Criar conta e entrar no grupo" e "Já tenho conta". Os dois levam `next` de volta ao convite.
- **Logado:** como antes. Aceitar; quem já é membro vai direto para o grupo; e o aviso de convite por e-mail destinado a outra conta.
- **Privacidade:** a prévia pública (`previewInvitationPublic`) mostra só o que o convite já mostrava a quem o abria logado. Nada de e-mails nem lista de membros.
  - Quem tem o link é o convidado. O token tem 256 bits, não dá para adivinhar, e o banco guarda só o hash.
  - `noindex` (cabeçalho e meta) e `Referrer-Policy` continuam.
- **Proxy:** libera só `/convites/<token>` e a imagem da prévia (`/convites/<token>/opengraph-image…`). A lista `/convites` continua exigindo login. Há teste de unidade do proxy.

## Prévia do link (WhatsApp, Telegram, iMessage…)

- **Texto:** `generateMetadata` gera título e descrição, como "Ana convidou você para “Viagem”" e "3 pessoas já estão no grupo…".
  - Para robôs de prévia, o Next põe os metadados no `<head>`. Para navegadores comuns, eles chegam junto com o resto da página.
  - Convite inválido ou expirado gera uma prévia genérica, sem dados.
- **Imagem:** `opengraph-image.tsx` gera um PNG de 1200×630 com a marca, o nome do grupo, quem convidou e quantas pessoas há.
  - A fonte é a Nunito (títulos do app), buscada do Google Fonts na primeira imagem e guardada em memória. Se a busca falhar, sai na fonte padrão, sem quebrar a prévia.

## Verificado (E2E)

- Botão do WhatsApp com a mensagem e o link.
- QR Code visível.
- Página do convite sem login, com o link de cadastro levando `next`.
- Com o user-agent do WhatsApp: `og:title`, `robots noindex` e `og:image` respondendo `image/png`.
