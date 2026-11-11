"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/app/page-header";
import { useAction } from "@/hooks/use-action";
import { addPixKeyAction, removePixKeyAction, updateProfileAction } from "@/server/actions/profile";

const currencies = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "UYU"] as const;
const pixTypes = [
  { value: "CPF", label: "CPF" },
  { value: "PHONE", label: "Celular" },
  { value: "EMAIL", label: "E-mail" },
  { value: "RANDOM", label: "Aleatória" },
  { value: "CNPJ", label: "CNPJ" },
] as const;

type Profile = {
  name: string;
  preferences: { defaultCurrency: string; emailOnExpense: boolean; emailOnSettlement: boolean; emailOnInvitation: boolean; pixCity: string | null };
  pixKeys: { id: string; type: string; value: string; label: string | null; isDefault: boolean }[];
};

const selectCls = "border-input bg-card focus-visible:ring-ring/30 focus-visible:border-ring h-12 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-[3px]";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const save = useAction(updateProfileAction);
  const [name, setName] = useState(profile.name);
  const [currency, setCurrency] = useState(profile.preferences.defaultCurrency);
  const [pixCity, setPixCity] = useState(profile.preferences.pixCity ?? "");


  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void save.run(
          { name, defaultCurrency: currency as (typeof currencies)[number], pixCity },
          { successMessage: "Perfil atualizado", onSuccess: () => router.refresh() },
        );
      }}
    >
      <section>
        <SectionTitle>Dados</SectionTitle>
        <div className="bg-card space-y-4 rounded-2xl border shadow-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nome</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" aria-invalid={save.fieldErrors.name ? true : undefined} />
            {save.fieldErrors.name ? <p className="text-destructive text-sm">{save.fieldErrors.name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-currency">Moeda padrão para novos grupos</Label>
            <select id="p-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls}>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-city">Sua cidade</Label>
            <Input
              id="p-city"
              value={pixCity}
              onChange={(e) => setPixCity(e.target.value)}
              maxLength={40}
              autoComplete="address-level2"
              placeholder="Ex.: São Paulo"
              aria-describedby="p-city-hint"
              aria-invalid={save.fieldErrors.pixCity ? true : undefined}
            />
            <p id="p-city-hint" className="text-muted-foreground text-xs">
              Vai no Pix Copia e Cola de quem te paga. Alguns bancos recusam o código sem ela.
            </p>
            {save.fieldErrors.pixCity ? <p className="text-destructive text-sm">{save.fieldErrors.pixCity}</p> : null}
          </div>
        </div>
      </section>

      <Button type="submit" disabled={save.pending}>
        {save.pending ? <Loader2 className="animate-spin" /> : <Check />} Salvar perfil
      </Button>
    </form>
  );
}

export function PixKeys({ keys }: { keys: Profile["pixKeys"] }) {
  const router = useRouter();
  const add = useAction(addPixKeyAction);
  const remove = useAction(removePixKeyAction);
  const [type, setType] = useState<(typeof pixTypes)[number]["value"]>("CPF");
  const [value, setValue] = useState("");
  const label = (t: string) => pixTypes.find((p) => p.value === t)?.label ?? t;

  return (
    <section>
      <SectionTitle>Chaves Pix</SectionTitle>
      <div className="bg-card rounded-2xl border shadow-card p-4">
        <p className="text-muted-foreground text-xs">
          Ficam visíveis só para quem participa de grupos com você, para facilitar o acerto. O Meluno não faz transferências.
        </p>
        {keys.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {keys.map((k) => (
              <li key={k.id} className="bg-muted/60 flex items-center gap-3 rounded-xl px-3 py-2">
                <KeyRound className="text-muted-foreground size-4" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs">{label(k.type)}</p>
                  <p className="truncate font-mono text-sm">{k.value}</p>
                </div>
                {k.isDefault ? <Badge variant="mint">Principal</Badge> : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remover chave"
                  disabled={remove.pending}
                  onClick={() => remove.run({ id: k.id }, { successMessage: "Chave removida", onSuccess: () => router.refresh() })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {keys.length < 5 ? (
          <form
            noValidate
            className="mt-4 grid gap-2 sm:grid-cols-[140px_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              void add.run(
                { type, value },
                {
                  successMessage: "Chave adicionada",
                  onSuccess: () => {
                    setValue("");
                    router.refresh();
                  },
                },
              );
            }}
          >
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Tipo de chave" className={selectCls}>
              {pixTypes.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Chave Pix"
              placeholder={type === "CPF" ? "000.000.000-00" : type === "PHONE" ? "(11) 91234-5678" : type === "EMAIL" ? "voce@email.com" : "Chave"}
              inputMode={type === "CPF" || type === "CNPJ" || type === "PHONE" ? "numeric" : type === "EMAIL" ? "email" : "text"}
              aria-invalid={add.fieldErrors.value ? true : undefined}
            />
            <Button type="submit" variant="outline" disabled={add.pending || !value.trim()}>
              {add.pending ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar
            </Button>
            {add.fieldErrors.value ? <p className="text-destructive text-sm sm:col-span-3">{add.fieldErrors.value}</p> : null}
          </form>
        ) : null}
      </div>
    </section>
  );
}
