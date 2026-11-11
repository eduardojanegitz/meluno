"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Copy, FileSpreadsheet, Link2, Loader2, LogOut, Mail, MoreVertical, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { groupCategories, type GroupCategory } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MemberAvatar } from "@/components/member-avatar";
import { Money } from "@/components/money/money";
import { SectionTitle } from "@/components/app/page-header";
import { RecurringSection, type RecurringItem } from "./recurring-section";
import { useAction } from "@/hooks/use-action";
import {
  addMemberAction,
  archiveGroupAction,
  changeRoleAction,
  createInvitationAction,
  leaveGroupAction,
  removeMemberAction,
  revokeInvitationAction,
  updateGroupAction,
} from "@/server/actions/groups";

type Member = { id: string; name: string; status: string; role: string; isViewer: boolean; hasEmail: boolean; balanceMinor: number; imageUrl: string | null };
type Invitation = { id: string; kind: "EMAIL" | "LINK"; email: string | null; expiresAt: Date; useCount: number; invitedBy: { displayName: string } };

type Props = {
  group: { id: string; name: string; description: string | null; category: GroupCategory; currency: string; simplifyDebts: boolean; archived: boolean };
  isAdmin: boolean;
  members: Member[];
  invitations: Invitation[];
  recurring: RecurringItem[];
};

export function GroupSettings({ group, isAdmin, members, invitations, recurring }: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-10 pb-10">
      {!group.archived ? <InviteSection groupId={group.id} invitations={invitations} onChange={refresh} /> : null}
      <MembersSection group={group} isAdmin={isAdmin} members={members} onChange={refresh} />
      {isAdmin && !group.archived ? <GroupForm group={group} onSaved={refresh} /> : null}
      <RecurringSection groupId={group.id} currency={group.currency} items={recurring} />
      <section className="space-y-2">
        <SectionTitle>Planilha</SectionTitle>
        <p className="text-muted-foreground text-sm">Todas as despesas e acertos, com a parte de cada pessoa. Abre no Excel, Google Planilhas e Numbers.</p>
        <Button asChild variant="outline" className="w-full">
          <a href={`/api/grupos/${group.id}/exportar`} download>
            <FileSpreadsheet aria-hidden="true" /> Baixar planilha
          </a>
        </Button>
      </section>
      <DangerSection group={group} isAdmin={isAdmin} viewerBalance={members.find((m) => m.isViewer)?.balanceMinor ?? 0} />
    </div>
  );
}

function InviteSection({ groupId, invitations, onChange }: { groupId: string; invitations: Invitation[]; onChange: () => void }) {
  const createLink = useAction(createInvitationAction);
  const createEmail = useAction(createInvitationAction);
  const revoke = useAction(revokeInvitationAction);
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  }

  async function share(url: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Convite para o Meluno", text: "Entre no nosso grupo no Meluno para dividir as despesas:", url });
        return;
      } catch {
        /* usuário cancelou */
      }
    }
    await copy(url);
  }

  return (
    <section id="convidar" className="scroll-mt-24">
      <SectionTitle>Convidar pessoas</SectionTitle>
      <div className="bg-card space-y-5 rounded-2xl border shadow-card p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="size-4" aria-hidden="true" /> Link de convite
          </p>
          <p className="text-muted-foreground mt-1 text-xs">Quem tiver o link pode entrar no grupo. Vale por 7 dias.</p>
          {link ? (
            <div className="mt-3 flex gap-2">
              <Input readOnly value={link} aria-label="Link de convite" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
              <Button type="button" variant="mint" onClick={() => share(link)}>
                <Copy /> Compartilhar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={createLink.pending}
              onClick={() =>
                createLink.run(
                  { kind: "LINK", groupId },
                  {
                    onSuccess: ({ url }) => {
                      setLink(url);
                      onChange();
                    },
                  },
                )
              }
            >
              {createLink.pending ? <Loader2 className="animate-spin" /> : <Link2 />} Gerar link
            </Button>
          )}
        </div>

        <form
          className="border-t pt-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void createEmail.run(
              { kind: "EMAIL", groupId, email },
              {
                successMessage: "Convite enviado",
                onSuccess: () => {
                  setEmail("");
                  onChange();
                },
              },
            );
          }}
        >
          <Label htmlFor="invite-email" className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4" aria-hidden="true" /> Convidar por e-mail
          </Label>
          <p className="text-muted-foreground mt-1 text-xs">Se a pessoa já estiver no grupo sem conta, ela herda o histórico ao entrar.</p>
          <div className="mt-3 flex gap-2">
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@email.com"
              aria-invalid={createEmail.fieldErrors.email ? true : undefined}
            />
            <Button type="submit" disabled={createEmail.pending || !email.includes("@")}>
              {createEmail.pending ? <Loader2 className="animate-spin" /> : null} Enviar
            </Button>
          </div>
          {createEmail.fieldErrors.email ? <p className="text-destructive mt-1 text-sm">{createEmail.fieldErrors.email}</p> : null}
        </form>

        {invitations.length > 0 ? (
          <div className="border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">Convites ativos</p>
            <ul className="space-y-2">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 text-sm">
                  {inv.kind === "EMAIL" ? <Mail className="text-muted-foreground size-4" aria-hidden="true" /> : <Link2 className="text-muted-foreground size-4" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate">
                    {inv.kind === "EMAIL" ? inv.email : `Link · ${inv.useCount} ${inv.useCount === 1 ? "entrada" : "entradas"}`}
                    <span className="text-muted-foreground"> · expira {new Date(inv.expiresAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cancelar convite"
                    disabled={revoke.pending}
                    onClick={() => revoke.run({ groupId, invitationId: inv.id }, { successMessage: "Convite cancelado", onSuccess: onChange })}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MembersSection({ group, isAdmin, members, onChange }: { group: Props["group"]; isAdmin: boolean; members: Member[]; onChange: () => void }) {
  const add = useAction(addMemberAction);
  const remove = useAction(removeMemberAction);
  const role = useAction(changeRoleAction);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [removing, setRemoving] = useState<Member | null>(null);
  const visible = members.filter((m) => m.status === "ACTIVE" || m.status === "PROVISIONAL");

  return (
    <section>
      <SectionTitle>Pessoas no grupo</SectionTitle>
      <ul className="bg-card divide-y rounded-2xl border shadow-card">
        {visible.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <MemberAvatar name={m.name} colorKey={m.id} imageUrl={m.imageUrl} provisional={m.status === "PROVISIONAL"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.isViewer ? `${m.name} (você)` : m.name}</p>
              <p className="text-muted-foreground text-xs">
                {m.status === "PROVISIONAL" ? (m.hasEmail ? "Convidado · sem conta" : "Sem conta") : m.role === "ADMIN" ? "Administrador(a)" : "Participante"}
              </p>
            </div>
            {m.role === "ADMIN" && m.status === "ACTIVE" ? <Badge variant="secondary">Admin</Badge> : null}
            {isAdmin && !m.isViewer && !group.archived ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Opções para ${m.name}`}>
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {m.status === "ACTIVE" ? (
                    <DropdownMenuItem
                      onSelect={() =>
                        role.run({ groupId: group.id, memberId: m.id, role: m.role === "ADMIN" ? "MEMBER" : "ADMIN" }, { successMessage: "Permissão atualizada", onSuccess: onChange })
                      }
                    >
                      <ShieldCheck /> {m.role === "ADMIN" ? "Remover de administrador" : "Tornar administrador"}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(m)}>
                    <UserMinus /> Remover do grupo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </li>
        ))}
      </ul>

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && removing.balanceMinor !== 0 ? (
                <>
                  {removing.name} tem saldo de <Money amountMinor={removing.balanceMinor} currency={group.currency} signed /> neste grupo. A pessoa continuará aparecendo nos saldos como ex-membro até o acerto.
                </>
              ) : (
                "A pessoa perde o acesso ao grupo. O histórico de despesas é mantido."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => removing && remove.run({ groupId: group.id, memberId: removing.id }, { successMessage: "Pessoa removida", onSuccess: onChange })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!group.archived ? (
        <form
          noValidate
          className="bg-card mt-3 rounded-2xl border shadow-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void add.run(
              { groupId: group.id, name, email },
              {
                successMessage: `${name.trim()} adicionado(a)`,
                onSuccess: () => {
                  setName("");
                  setEmail("");
                  onChange();
                },
              },
            );
          }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="size-4" aria-hidden="true" /> Adicionar alguém sem conta
          </p>
          <p className="text-muted-foreground mt-1 text-xs">Útil para quem não usa o Meluno. Você pode convidar a pessoa depois.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" aria-label="Nome" maxLength={60} />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional)" aria-label="E-mail (opcional)" type="email" inputMode="email" />
            <Button type="submit" variant="outline" disabled={add.pending || !name.trim()}>
              {add.pending ? <Loader2 className="animate-spin" /> : null} Adicionar
            </Button>
          </div>
          {add.fieldErrors.email ? <p className="text-destructive mt-1 text-sm">{add.fieldErrors.email}</p> : null}
        </form>
      ) : null}
    </section>
  );
}

function GroupForm({ group, onSaved }: { group: Props["group"]; onSaved: () => void }) {
  const save = useAction(updateGroupAction);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [category, setCategory] = useState<GroupCategory>(group.category);
  const [simplify, setSimplify] = useState(group.simplifyDebts);
  const dirty = name !== group.name || description !== (group.description ?? "") || category !== group.category || simplify !== group.simplifyDebts;

  return (
    <section>
      <SectionTitle>Configurações do grupo</SectionTitle>
      <form
        noValidate
        className="bg-card space-y-5 rounded-2xl border shadow-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save.run({ groupId: group.id, name, description, category, simplifyDebts: simplify }, { successMessage: "Grupo atualizado", onSuccess: onSaved });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="g-name">Nome</Label>
          <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={save.fieldErrors.name ? true : undefined} />
          {save.fieldErrors.name ? <p className="text-destructive text-sm">{save.fieldErrors.name}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-desc">Descrição (opcional)</Label>
          <Input id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} />
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo do grupo">
          {(Object.keys(groupCategories) as GroupCategory[]).map((key) => {
            const { label, icon: Icon } = groupCategories[key];
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={key === category}
                onClick={() => setCategory(key)}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-2",
                  key === category ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                )}
              >
                <Icon className="size-4" aria-hidden="true" /> {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
          <div>
            <Label htmlFor="g-simplify" className="text-sm font-medium">
              Simplificar dívidas
            </Label>
            <p className="text-muted-foreground text-xs">Sugere o menor número de transferências. Os registros não mudam.</p>
          </div>
          <Switch id="g-simplify" checked={simplify} onCheckedChange={setSimplify} />
        </div>
        <p className="text-muted-foreground text-xs">Moeda: {group.currency} (não pode ser alterada depois de criada).</p>
        <Button type="submit" disabled={!dirty || save.pending}>
          {save.pending ? <Loader2 className="animate-spin" /> : <Check />} Salvar
        </Button>
      </form>
    </section>
  );
}

function DangerSection({ group, isAdmin, viewerBalance }: { group: Props["group"]; isAdmin: boolean; viewerBalance: number }) {
  const router = useRouter();
  const leave = useAction(leaveGroupAction);
  const archive = useAction(archiveGroupAction);

  return (
    <section className="space-y-2">
      <SectionTitle>Saída</SectionTitle>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full justify-start" disabled={leave.pending}>
            <LogOut /> Sair do grupo
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair de {group.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {viewerBalance !== 0 ? (
                <>
                  Você ainda tem saldo de <Money amountMinor={viewerBalance} currency={group.currency} signed /> aqui. Acerte as contas antes de sair.
                </>
              ) : (
                "Você deixa de ver o grupo. O histórico continua para os demais."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {viewerBalance === 0 ? (
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-white"
                onClick={() => leave.run({ groupId: group.id }, { successMessage: "Você saiu do grupo", onSuccess: () => router.replace("/grupos") })}
              >
                Sair
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isAdmin ? (
        <Button
          variant="ghost"
          className="text-muted-foreground w-full justify-start"
          disabled={archive.pending}
          onClick={() =>
            archive.run(
              { groupId: group.id, archived: !group.archived },
              { successMessage: group.archived ? "Grupo reativado" : "Grupo arquivado", onSuccess: () => router.refresh() },
            )
          }
        >
          <Archive /> {group.archived ? "Reativar grupo" : "Arquivar grupo (somente leitura)"}
        </Button>
      ) : null}
    </section>
  );
}
