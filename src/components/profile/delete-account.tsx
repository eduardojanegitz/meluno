"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import { deleteAccountAction } from "@/server/actions/profile";

const WORD = "EXCLUIR";

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const del = useAction(deleteAccountAction);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const ready = confirmation.trim().toUpperCase() === WORD && (!hasPassword || password.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (del.pending) return;
        setOpen(v);
        if (!v) {
          setConfirmation("");
          setPassword("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:text-destructive -ml-3 justify-start">
          <Trash2 /> Excluir minha conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir sua conta?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-left">
              <p>Isso não pode ser desfeito.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Seu nome, e-mail, chaves Pix, preferências e sessões serão apagados.</li>
                <li>Nos grupos, você aparecerá como “Usuário removido”. As despesas e pagamentos continuam, porque fazem parte dos saldos das outras pessoas.</li>
                <li>Saldos em aberto não são perdoados nem acertados automaticamente.</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>

        <form
          id="delete-account"
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            void del.run(
              { confirmation, password: hasPassword ? password : undefined },
              {
                // Recarga completa de propósito: descarta o estado das páginas autenticadas que o Next mantém em memória.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                onSuccess: () => window.location.assign("/conta-excluida"),
              },
            );
          }}
        >
          {hasPassword ? (
            <div className="space-y-1.5">
              <Label htmlFor="da-password">Sua senha</Label>
              <Input id="da-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="da-confirm">
              Digite <span className="font-mono font-bold">{WORD}</span> para confirmar
            </Label>
            <Input
              id="da-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={del.fieldErrors.confirmation ? true : undefined}
            />
            {del.fieldErrors.confirmation ? <p className="text-destructive text-sm">{del.fieldErrors.confirmation}</p> : null}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={del.pending}>
            Cancelar
          </Button>
          <Button type="submit" form="delete-account" variant="destructive" disabled={!ready || del.pending}>
            {del.pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
