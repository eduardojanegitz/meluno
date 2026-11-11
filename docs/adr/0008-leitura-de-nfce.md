# ADR 0008: Leitura do QR Code da NFC-e

- Status: aceito
- Data: 2026-11-11

## O que o QR traz

O QR Code da NFC-e (nota do consumidor, modelo 65) é um link para a consulta pública da SEFAZ do estado.

- **Nota online (o caso comum):** só a **chave de acesso**. A chave informa estado, ano/mês, CNPJ, série e número. **Não traz valor nem dia.**
- **Nota em contingência (offline):** a chave, o **dia** e o **valor total**.
- **Itens:** só existem na página da SEFAZ.

Suportamos as versões 1 (parâmetros `chNFe`, `vNF`, `dhEmi` em hexadecimal), 2 e 3 (`p=chave|versão|ambiente|…`) e a chave digitada. A chave é validada (44 dígitos, DV módulo 11, modelo 65). QR de Pix, de NF-e (modelo 55) ou de outros sites é recusado.

## Fluxo

1. O cliente lê o QR:
   - pela câmera, com o `BarcodeDetector` nativo (Chrome/Android) ou com o `jsqr`, carregado só quando preciso (iPhone, Firefox);
   - por uma foto;
   - colando o link ou a chave.
2. O servidor (`readNfceAction`) busca a página da SEFAZ e lê o layout padrão do portal da NFC-e (tabela `#tabResult`), usado pela maioria dos estados.
3. O resultado vira a divisão por item (ADR 0006):
   - nomes em caixa normal e quantidade no nome ("12 un · Cerveja lata");
   - **desconto da nota distribuído entre os itens** pelo maior resto, na proporção do valor;
   - taxa de serviço 0% (a nota já é o valor final);
   - todos marcados como consumidores, para a pessoa desmarcar;
   - acima de 60 itens, o restante vira "Outros itens (n)".
4. **Sempre há resultado:**
   - se a SEFAZ falhar (fora do ar, captcha, layout diferente, certificado), fica só o que o QR informa;
   - descrição "Compra com nota fiscal", chave nas observações e, se houver, valor e data;
   - a pessoa completa o resto.

A data vem da página ("Emissão: dd/mm/aaaa") ou do dia do QR com o mês/ano da chave. A loja vira a descrição e sugere a categoria (Mercado por padrão).

## Segurança

O servidor busca uma URL que veio do usuário, então há proteção contra SSRF:

- só `http`/`https`, portas padrão, sem usuário/senha na URL e sem IP direto;
- só hosts **`*.gov.br`**;
- o DNS não pode resolver para endereço interno (loopback, privado, CGNAT, link-local, multicast; IPv4 e IPv6);
- redirecionamentos são seguidos manualmente (até 3) e cada destino é revalidado;
- tempo de 8 s e resposta de no máximo 2 MB;
- 20 leituras a cada 10 minutos por pessoa (`enforceRateLimit`).

O logger registra só o estado e o host, sem a chave nem os itens.

Risco residual: DNS rebinding entre a validação e a conexão. É baixo, porque o domínio precisa ser `.gov.br`. Fechar isso exigiria fixar o IP na conexão.

A câmera passou de `camera=()` para `camera=(self)` no `Permissions-Policy`: liberada só para o próprio site.

## Limites conhecidos

- O leitor foi escrito para o layout padrão e testado com uma página de exemplo. **Ainda não foi testado com notas reais de cada estado.** Estados com layout próprio (ex.: MG) caem no modo "só QR" até ganharem um leitor.
- Algumas SEFAZ exigem captcha ou bloqueiam acesso automatizado. Nesses casos também vale o modo "só QR".
- Notas de homologação (ambiente 2) são aceitas, com aviso.
