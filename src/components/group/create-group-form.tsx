"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupCategories, type GroupCategory } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { createGroupAction } from "@/server/actions/groups";
import { celebrate } from "@/components/celebrate/celebration";

const currencies = [
  { code: "BRL", label: "Real (R$)" },
  { code: "USD", label: "Dólar (US$)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "ARS", label: "Peso argentino" },
  { code: "CLP", label: "Peso chileno" },
  { code: "UYU", label: "Peso uruguaio" },
  { code: "GBP", label: "Libra (£)" },
] as const;

type Person = { key: number; name: string; email: string };

/** Remontado após criar (o Next preserva o estado de páginas visitadas). */
export function CreateGroupForm() {
  const [generation, setGeneration] = useState(0);
  return <CreateGroupFormInner key={generation} onCreated={() => setGeneration((n) => n + 1)} />;
}

function CreateGroupFormInner({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const { run, pending, fieldErrors } = useAction(createGroupAction);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GroupCategory>("FRIENDS");
  const [currency, setCurrency] = useState<(typeof currencies)[number]["code"]>("BRL");
  const [people, setPeople] = useState<Person[]>([{ key: 1, name: "", email: "" }]);
  const [nameError, setNameError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<Person>) => setPeople((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError("Dê um nome ao grupo.");
      return;
    }
    setNameError(null);
    await run(
      {
        name,
        category,
        currency,
        people: people.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), email: p.email.trim() })),
      },
      {
        onSuccess: ({ groupId }) => {
          celebrate({ title: "Grupo criado!", subtitle: "Agora é anotar os gastos e chamar a turma.", big: true });
          router.push(`/grupos/${groupId}`);
          onCreated();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-7 pb-8">
      <div className="space-y-1.5">
        <Label htmlFor="group-name">Nome do grupo</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Viagem para a praia"
          maxLength={60}
          autoFocus
          aria-invalid={nameError || fieldErrors.name ? true : undefined}
          aria-describedby={nameError || fieldErrors.name ? "group-name-error" : undefined}
        />
        {nameError || fieldErrors.name ? (
          <p id="group-name-error" className="text-destructive text-sm">
            {nameError ?? fieldErrors.name}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tipo</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup">
          {(Object.keys(groupCategories) as GroupCategory[]).map((key) => {
            const { label, icon: Icon } = groupCategories[key];
            const active = key === category;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategory(key)}
                className={cn(
                  "focus-visible:ring-ring flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={1.9} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Quem divide com você?</legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Basta o nome. Com o e-mail, a pessoa recebe um convite depois e herda o histórico ao entrar.
        </p>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {people.map((p, i) => (
              <motion.li
                key={p.key}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2"
              >
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input value={p.name} onChange={(e) => update(p.key, { name: e.target.value })} placeholder={`Nome da pessoa ${i + 1}`} aria-label={`Nome da pessoa ${i + 1}`} maxLength={60} />
                  <Input
                    value={p.email}
                    onChange={(e) => update(p.key, { email: e.target.value })}
                    placeholder="E-mail (opcional)"
                    aria-label={`E-mail da pessoa ${i + 1} (opcional)`}
                    type="email"
                    inputMode="email"
                    aria-invalid={fieldErrors[`people.${i}.email`] ? true : undefined}
                  />
                  {fieldErrors[`people.${i}.email`] ? <p className="text-destructive text-sm sm:col-span-2">{fieldErrors[`people.${i}.email`]}</p> : null}
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remover pessoa ${i + 1}`} onClick={() => setPeople((ps) => ps.filter((x) => x.key !== p.key))}>
                  <X />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setPeople((ps) => [...ps, { key: Date.now(), name: "", email: "" }])}>
          <Plus /> Adicionar pessoa
        </Button>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="group-currency">Moeda</Label>
        <select
          id="group-currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as typeof currency)}
          className="border-input bg-card focus-visible:ring-ring/30 focus-visible:border-ring h-12 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-[3px]"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">Todas as despesas do grupo usam esta moeda.</p>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Criar grupo
      </Button>
    </form>
  );
}
