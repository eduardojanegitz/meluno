import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso">
      <p>
        Estes termos valem entre você e <strong>{LEGAL.controller}</strong>, responsável pelo Meluno. Ao criar uma conta, você concorda com eles e com a{" "}
        <Link href="/privacidade">Política de privacidade</Link>.
      </p>

      <h2>O que o Meluno faz</h2>
      <p>
        O Meluno é uma ferramenta para registrar gastos compartilhados, calcular quanto cada pessoa deve e sugerir acertos. <strong>O Meluno não movimenta dinheiro</strong>:
        não guarda saldo, não intermedeia pagamentos e não é instituição financeira. O Pix Copia e Cola é só um atalho; o pagamento acontece no seu banco, sob sua
        responsabilidade.
      </p>

      <h2>Sua conta</h2>
      <ul>
        <li>Você precisa ter pelo menos 18 anos.</li>
        <li>Use dados verdadeiros e mantenha sua senha em segredo. Você responde pelo que for feito na sua conta.</li>
        <li>Você pode excluir a conta quando quiser, no Perfil.</li>
      </ul>

      <h2>Grupos e o que você registra</h2>
      <ul>
        <li>
          O que você lança num grupo (gastos, acertos, observações, chaves Pix) fica visível para as pessoas do grupo. Só adicione alguém ou o e-mail de alguém se tiver
          motivo legítimo para isso.
        </li>
        <li>
          Os cálculos dependem do que é registrado. Confira os valores: o Meluno não garante que um lançamento esteja certo nem que alguém vá pagar o que deve.
        </li>
        <li>Saldos não são cobrança oficial nem título de dívida. Divergências entre as pessoas são resolvidas entre elas.</li>
        <li>Ao sair de um grupo ou excluir a conta, os lançamentos continuam no grupo, porque compõem o saldo das outras pessoas.</li>
      </ul>

      <h2>Uso proibido</h2>
      <ul>
        <li>usar o Meluno para fraude, lavagem de dinheiro, cobrança abusiva ou assédio;</li>
        <li>tentar acessar dados de grupos dos quais você não participa, burlar limites ou atacar o serviço;</li>
        <li>enviar convites ou lembretes em massa para quem não participa dos seus gastos.</li>
      </ul>
      <p>Podemos suspender contas que violem estes termos, avisando sempre que possível.</p>

      <h2>Disponibilidade e responsabilidade</h2>
      <p>
        O Meluno é oferecido &ldquo;como está&rdquo;. Trabalhamos para que ele funcione bem e com segurança, mas pode haver falhas e interrupções. Recursos que dependem de
        terceiros (Google, SEFAZ, e-mail) podem ficar indisponíveis. Na medida permitida por lei, não respondemos por prejuízos indiretos ou por decisões tomadas com base
        nos cálculos do app. Nada aqui limita seus direitos como consumidor.
      </p>

      <h2>Mudanças</h2>
      <p>Podemos atualizar estes termos. Se a mudança for importante, avisaremos no app antes de valer. Continuar usando depois disso significa concordar com a nova versão.</p>

      <h2>Lei e foro</h2>
      <p>
        Vale a lei brasileira. Eventuais disputas ficam no foro do seu domicílio.
      </p>

      <h2>Contato</h2>
      <p>
        <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>
      </p>
    </LegalPage>
  );
}
