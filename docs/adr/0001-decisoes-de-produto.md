# ADR 0001 — Decisões de produto do MVP

- Status: aceito
- Data: 2026-11-10

Decisões de regra de negócio aprovadas antes da implementação. Alterá-las exige novo ADR.

## 1. Participantes sem conta (membros provisórios)

- Despesas, divisões e acertos referenciam `GroupMember`, nunca `User` diretamente.
- Um membro pode ser **provisório**: apenas nome e, opcionalmente, e-mail.
- Ao aceitar um convite, o usuário **assume** o membro provisório vinculado ao convite; o histórico não é duplicado.
- No mesmo grupo não podem existir dois membros com o mesmo e-mail normalizado, nem dois membros vinculados ao mesmo usuário.
- Um usuário que já é membro ativo não pode assumir outro membro provisório do mesmo grupo.

## 2. Confirmação de pagamentos (acertos)

- Registrado pelo **recebedor** → confirmado imediatamente e afeta o saldo.
- Registrado pelo **pagador** (ou por terceiro) → fica `PENDING` e **não afeta o saldo** até o recebedor confirmar.
- Se o recebedor for membro provisório, qualquer administrador do grupo pode confirmar.
- O recebedor pode recusar um acerto pendente.
- Exibir uma chave Pix nunca implica que um pagamento ocorreu.

## 3. Edição e exclusão de despesas

- Qualquer membro ativo pode criar despesas.
- Editar ou excluir: autor da despesa ou administradores.
- Toda edição é registrada com snapshot anterior/posterior e é visível a todos do grupo.
- Exclusão é reversível (soft delete); a despesa sai do saldo e permanece no histórico.

## 4. Saída e remoção de membros

- Um membro não pode sair do grupo com saldo diferente de zero.
- Um administrador pode remover um membro com saldo; ele passa a "ex-membro" e permanece nos saldos e no histórico.

## 5. Arredondamento

- Método do maior resto (Hamilton) sobre centavos inteiros.
- Desempate determinístico que **alterna por despesa**: a ordem de desempate é derivada do id da despesa, para que o mesmo membro não absorva sempre o centavo extra.
- O resultado é persistido em `ExpenseSplit.amountMinor`.

## 6. Moedas e escopo

- Uma moeda por grupo (BRL por padrão). Saldos de moedas diferentes nunca são somados.
- MVP apenas com despesas dentro de grupos; um casal/dupla é um grupo de 2.

## 7. LGPD — exclusão de conta

- Dados pessoais são apagados (e-mail, chaves Pix, avatar, sessões, preferências).
- Nos grupos, o membro passa a "Usuário removido"; registros financeiros são preservados porque afetam os saldos dos demais.

## 8. Simplificação de dívidas

- Ligada por padrão em todo grupo, com opção de desligar.
- Algoritmo exato (partição em subconjuntos de soma zero via bitmask) para até 12 membros com saldo não nulo; acima disso, guloso com pré-passe de pares exatos. A limitação do guloso (não garante o mínimo) é documentada.
- A simplificação é apenas uma sugestão calculada; não altera registros de origem.
