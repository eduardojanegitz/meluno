import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade">
      <p>
        O Meluno ajuda grupos a registrar gastos compartilhados e descobrir quem deve quanto para quem. Esta política explica quais dados pessoais tratamos, por quê,
        com quem compartilhamos e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).
      </p>

      <h2>Quem é o responsável</h2>
      <p>
        O controlador dos dados é <strong>{LEGAL.controller}</strong>. Pedidos e dúvidas sobre dados pessoais:{" "}
        <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
      </p>

      <h2>Quais dados tratamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> nome, e-mail, senha (guardada só como hash, nunca em texto) e, se você entrar com o Google, a foto de perfil e o identificador da conta
          Google.
        </li>
        <li>
          <strong>Uso do app:</strong> grupos, despesas (descrição, valor, data, categoria, observações, itens, recorrência), acertos, convites e o histórico de alterações.
        </li>
        <li>
          <strong>Fotos de comprovante</strong>, se você anexar. Removemos os metadados da foto (como localização GPS e modelo do aparelho) antes de guardar. Elas são vistas só
          pelas pessoas do grupo e apagadas junto com a despesa.
        </li>
        <li>
          <strong>Chaves Pix e cidade</strong>, se você cadastrar, para montar o Pix Copia e Cola de quem vai te pagar.
        </li>
        <li>
          <strong>Notificações:</strong> se você ativar o push, guardamos o endereço de entrega que o navegador gera para este aparelho e um nome como &ldquo;Chrome no
          Android&rdquo;. Suas escolhas de e-mail (despesas, pagamentos, resumo semanal) ficam no Perfil.
        </li>
        <li>
          <strong>Segurança:</strong> sessões de login com endereço IP e navegador, e contadores de tentativas (para bloquear abuso).
        </li>
        <li>
          <strong>Nota fiscal (NFC-e):</strong> quando você lê o QR Code de um cupom, enviamos a chave da nota à SEFAZ do estado para buscar os itens. A chave e os itens
          ficam só na despesa que você salvar.
        </li>
        <li>
          <strong>Pessoas sem conta:</strong> quem cria um grupo pode adicionar pessoas pelo nome (e, se quiser, e-mail para convite). Essa pessoa pode pedir a exclusão do
          próprio e-mail pelo contato acima.
        </li>
      </ul>
      <p>Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros. Usamos só o cookie de sessão (necessário para manter o login) e o armazenamento do navegador para preferências como o tema.</p>

      <h2>Para que usamos e com qual base legal</h2>
      <ul>
        <li>
          <strong>Prestar o serviço</strong> (contas, grupos, saldos, lembretes, convites): execução de contrato (art. 7º, V).
        </li>
        <li>
          <strong>Segurança e prevenção de fraude</strong> (sessões, limites de tentativas, registros técnicos): legítimo interesse (art. 7º, IX).
        </li>
        <li>
          <strong>E-mails transacionais</strong> (confirmação de e-mail, recuperação de senha, convites e lembretes de pagamento): execução de contrato.
        </li>
      </ul>
      <p>Não vendemos dados pessoais e não os usamos para publicidade.</p>

      <h2>Quem vê seus dados</h2>
      <ul>
        <li>
          <strong>Pessoas dos seus grupos</strong> veem seu nome, sua foto, os gastos e acertos do grupo e, se você cadastrar, suas chaves Pix e sua cidade.
        </li>
        <li>
          <strong>Operadores</strong> que nos ajudam a funcionar, só para isso: {LEGAL.hosting} (hospedagem e banco de dados), Resend (envio de e-mails), Google (login,
          se você escolher) e o serviço de push do seu navegador (Google, Apple, Mozilla ou Microsoft), que recebe só o texto da notificação, criptografado. Alguns ficam fora do Brasil; a transferência segue o art. 33 da LGPD.
        </li>
        <li>
          <strong>SEFAZ</strong> do estado da nota, quando você usa a leitura de NFC-e.
        </li>
        <li>
          <strong>Autoridades</strong>, quando houver ordem judicial ou obrigação legal.
        </li>
      </ul>
      <p>O Meluno não movimenta dinheiro. Pagamentos por Pix acontecem no app do seu banco.</p>

      <h2>Por quanto tempo guardamos</h2>
      <ul>
        <li>Os dados da conta ficam enquanto ela existir.</li>
        <li>As sessões de login expiram em até 30 dias sem uso.</li>
        <li>
          <strong>Ao excluir a conta</strong>, apagamos seus dados pessoais: nome, e-mail, sessões, formas de login, chaves Pix, preferências e notificações. Nos grupos, os
          gastos e acertos continuam, porque fazem parte do saldo das outras pessoas, mas aparecem como &ldquo;Usuário removido&rdquo;. Descrições e observações que você escreveu em
          despesas do grupo permanecem.
        </li>
      </ul>

      <h2>Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode:</p>
      <ul>
        <li>confirmar se tratamos seus dados e acessá-los;</li>
        <li>
          <strong>baixar uma cópia</strong> (portabilidade): no app, em <Link href="/perfil">Perfil → Baixar meus dados</Link>;
        </li>
        <li>corrigir dados, no Perfil;</li>
        <li>
          <strong>excluir sua conta</strong>, em <Link href="/perfil">Perfil → Excluir minha conta</Link>;
        </li>
        <li>saber com quem compartilhamos e revogar o login com Google na sua conta Google;</li>
        <li>reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
      <p>
        Para qualquer outro pedido, escreva para <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>. Respondemos em até 15 dias.
      </p>

      <h2>Segurança</h2>
      <p>
        Usamos conexão criptografada (HTTPS), senhas com hash, limites de tentativas, controle de acesso por grupo e registros sem dados financeiros. Nenhum sistema é
        totalmente imune; se houver um incidente que gere risco a você, avisaremos você e a ANPD.
      </p>

      <h2>Crianças e adolescentes</h2>
      <p>O Meluno não é direcionado a menores de 18 anos.</p>

      <h2>Mudanças nesta política</h2>
      <p>Se mudarmos algo importante, avisaremos no app antes de valer. A data no topo mostra a última atualização.</p>

      <p>
        Veja também os <Link href="/termos">Termos de uso</Link>.
      </p>
    </LegalPage>
  );
}
