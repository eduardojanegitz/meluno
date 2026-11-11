"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, Loader2, Minus, Plus, Repeat, StickyNote, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { expenseCategories, type ExpenseCategory } from "@/lib/categories";
import { suggestCategory } from "@/lib/category-suggest";
import { formatMoney, todayCivil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/money/money-input";
import { Money } from "@/components/money/money";
import { MemberAvatar } from "@/components/member-avatar";
import { SplitMethodPicker, type SplitMethod } from "./split-method-picker";
import { computeItemSplit, computeSplit, PayerError, SplitError, validatePayers, PERCENT_SCALE, SHARES_SCALE, type SplitRequest } from "@/server/domain/split";
import { MoneyError } from "@/server/domain/money";
import { ItemsEditor, newItem, type ItemDraft } from "./items-editor";
import { ReceiptScanner } from "./receipt-scanner";
import { ForeignCurrencyFields, firstForeignCurrency, type ForeignDraft } from "./foreign-currency";
import { convertMinor, FxError, parseRate } from "@/server/domain/fx";
import type { NfceImport } from "@/server/domain/nfce";
import { useAction } from "@/hooks/use-action";
import { createExpenseAction, updateExpenseAction } from "@/server/actions/finance";
import { celebrate } from "@/components/celebrate/celebration";

export type FormMember = { id: string; name: string; provisional: boolean; imageUrl: string | null };

export type ExpenseInitial = {
  expenseId: string;
  version: number;
  description: string;
  amountMinor: number;
  date: string;
  category: ExpenseCategory;
  notes: string | null;
  payers: { memberId: string; amountMinor: number }[];
  splitMethod: SplitMethod;
  splits: { memberId: string; inputValue: number | null }[];
  /** Só na divisão por item. */
  items?: { description: string; amountMinor: number; memberIds: string[] }[];
  serviceBp?: number | null;
  feesMinor?: number | null;
  /** Despesa em outra moeda. */
  foreign?: ForeignDraft | null;
};

type Props = {
  group: { id: string; name: string; currency: string };
  members: FormMember[];
  viewerMemberId: string;
  initial?: ExpenseInitial;
  /** Descrição normalizada → categoria usada da última vez no grupo. */
  categoryHints?: Record<string, ExpenseCategory>;
};

/** "33,33" → 3333 (escala × 100). Retorna null se inválido. */
function parseScaled(raw: string, scale = 100): number | null {
  const clean = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (clean === "") return 0;
  if (!/^\d{1,6}(\.\d{0,2})?$/.test(clean)) return null;
  const [int, frac = ""] = clean.split(".");
  return Number(int) * scale + Number((frac + "00").slice(0, 2)) * (scale / 100);
}

function formatScaled(value: number, scale = 100): string {
  const int = Math.floor(value / scale);
  const frac = value % scale;
  return frac === 0 ? String(int) : `${int},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/**
 * O Next mantém o estado de páginas já visitadas (React Activity). Por isso o
 * formulário é remontado após salvar — novo id, campos limpos — e quando a
 * versão da despesa muda no servidor.
 */
export function ExpenseForm(props: Props) {
  const [generation, setGeneration] = useState(0);
  return <ExpenseFormInner key={`${generation}-${props.initial?.version ?? "new"}`} {...props} onSaved={() => setGeneration((g) => g + 1)} />;
}

function ExpenseFormInner({ group, members, viewerMemberId, initial, categoryHints, onSaved }: Props & { onSaved: () => void }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const create = useAction(createExpenseAction);
  const update = useAction(updateExpenseAction);
  const pending = create.pending || update.pending;

  const [expenseId] = useState(() => initial?.expenseId ?? crypto.randomUUID());
  const [amount, setAmount] = useState(initial?.amountMinor ?? 0);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? "OTHER");
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initial));
  const [date, setDate] = useState(initial?.date ?? todayCivil());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showMore, setShowMore] = useState(Boolean(initial?.notes));
  const [showCategories, setShowCategories] = useState(false);
  const [repeat, setRepeat] = useState<"" | "WEEKLY" | "MONTHLY">("");
  const [submitted, setSubmitted] = useState(false);

  // Pagadores
  const initialMulti = (initial?.payers.length ?? 1) > 1;
  const [multiPayer, setMultiPayer] = useState(initialMulti);
  const [singlePayer, setSinglePayer] = useState(initial?.payers[0]?.memberId ?? viewerMemberId);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries((initial?.payers ?? []).map((p) => [p.memberId, p.amountMinor])),
  );

  // Divisão
  const [method, setMethod] = useState<SplitMethod>(initial?.splitMethod ?? "EQUAL");
  const [participants, setParticipants] = useState<Set<string>>(
    () => new Set(initial ? initial.splits.map((s) => s.memberId) : members.map((m) => m.id)),
  );
  const [exact, setExact] = useState<Record<string, number>>(() =>
    initial?.splitMethod === "EXACT" ? Object.fromEntries(initial.splits.map((s) => [s.memberId, s.inputValue ?? 0])) : {},
  );
  const [percent, setPercent] = useState<Record<string, string>>(() =>
    initial?.splitMethod === "PERCENT" ? Object.fromEntries(initial.splits.map((s) => [s.memberId, formatScaled(s.inputValue ?? 0)])) : {},
  );
  const [shares, setShares] = useState<Record<string, number>>(() =>
    initial?.splitMethod === "SHARES" ? Object.fromEntries(initial.splits.map((s) => [s.memberId, s.inputValue ?? SHARES_SCALE])) : {},
  );

  // Divisão por item
  const [items, setItems] = useState<ItemDraft[]>(() =>
    initial?.items?.length ? initial.items.map((i) => ({ ...i, key: crypto.randomUUID() })) : [newItem(members.map((m) => m.id))],
  );
  const [serviceBp, setServiceBp] = useState(initial?.serviceBp ?? 1000);
  const [feesMinor, setFeesMinor] = useState(initial?.feesMinor ?? 0);
  const itemsMode = method === "ITEMS";

  // No modo itens o total é calculado (itens + serviço + taxas), mesma função do servidor.
  const itemCalc = useMemo(() => {
    if (!itemsMode) return null;
    try {
      return { ok: true as const, ...computeItemSplit({ items, serviceBp, feesMinor }, expenseId) };
    } catch (error) {
      const message = error instanceof SplitError || error instanceof MoneyError ? error.message : "Confira os itens.";
      const itemsMinor = items.reduce((s, i) => s + i.amountMinor, 0);
      return { ok: false as const, message, itemsMinor };
    }
  }, [itemsMode, items, serviceBp, feesMinor, expenseId]);
  // Outra moeda: o valor do grupo é o convertido (mesma conta do servidor).
  const [foreign, setForeign] = useState<ForeignDraft | null>(initial?.foreign ?? null);
  const foreignOn = foreign !== null && !itemsMode;
  const fx = useMemo(() => {
    if (!foreignOn || !foreign) return null;
    if (foreign.amountMinor <= 0) return { converted: 0, error: null };
    try {
      return { converted: convertMinor(foreign.amountMinor, foreign.currency, group.currency, parseRate(foreign.rate)), error: null };
    } catch (e) {
      return { converted: 0, error: e instanceof FxError ? e.message : "Confira a cotação." };
    }
  }, [foreignOn, foreign, group.currency]);
  const total = itemsMode ? (itemCalc?.ok ? itemCalc.totalMinor : 0) : foreignOn ? (fx?.converted ?? 0) : amount;

  const nameOf = (id: string) => (id === viewerMemberId ? "Você" : (members.find((m) => m.id === id)?.name ?? "Ex-membro"));
  const ordered = useMemo(() => [...members].sort((a, b) => (a.id === viewerMemberId ? -1 : b.id === viewerMemberId ? 1 : 0)), [members, viewerMemberId]);

  function onDescription(value: string) {
    setDescription(value);
    if (!categoryTouched) setCategory(suggestCategory(value, categoryHints) ?? "OTHER");
  }

  // Nota fiscal lida: itens viram a divisão por item (sem taxa de serviço, já está tudo na nota).
  function applyReceipt(r: NfceImport) {
    const allIds = members.map((m) => m.id);
    if (r.items.length > 0) {
      setMethod("ITEMS");
      setItems(r.items.map((i) => ({ key: crypto.randomUUID(), description: i.description, amountMinor: i.amountMinor, memberIds: allIds })));
      setServiceBp(0);
      setFeesMinor(0);
    } else if (r.totalMinor) {
      setAmount(r.totalMinor);
    }
    if (r.date) setDate(r.date);
    if (!description.trim()) {
      setDescription(r.store ?? "Compra com nota fiscal");
      if (!categoryTouched) setCategory(suggestCategory(r.store ?? "", categoryHints) ?? "GROCERIES");
    }
    if (!notes.trim()) {
      setNotes(`NFC-e ${r.uf} · chave ${r.chave.replace(/(\d{4})(?=\d)/g, "$1 ")}`);
      setShowMore(true);
    }
    if (r.items.length > 0) {
      toast.success(`${r.items.length} ${r.items.length === 1 ? "item importado" : "itens importados"}`, {
        description: r.discountMinor > 0 ? "O desconto da nota foi distribuído entre os itens. Marque quem consumiu cada um." : "Marque quem consumiu cada um.",
      });
    } else {
      toast.warning("Não conseguimos ler os itens desta nota", {
        description: r.totalMinor ? "Preenchemos o valor; confira e escolha como dividir." : "A SEFAZ não respondeu. Informe o valor da nota.",
      });
    }
    if (r.test) toast.info("Essa é uma nota de teste (homologação), sem valor fiscal.");
  }

  // Monta a requisição exatamente como o servidor a receberá.
  const payers = useMemo(
    () =>
      multiPayer
        ? Object.entries(payerAmounts)
            .filter(([, v]) => v > 0)
            .map(([memberId, amountMinor]) => ({ memberId, amountMinor }))
        : [{ memberId: singlePayer, amountMinor: total }],
    [multiPayer, payerAmounts, singlePayer, total],
  );

  const splitEntries = useMemo(() => {
    const ids = members.map((m) => m.id);
    switch (method) {
      case "EQUAL":
        return ids.filter((id) => participants.has(id)).map((memberId) => ({ memberId }));
      case "EXACT":
        return ids.filter((id) => (exact[id] ?? 0) > 0).map((memberId) => ({ memberId, value: exact[memberId]! }));
      case "PERCENT":
        return ids
          .map((memberId) => ({ memberId, value: parseScaled(percent[memberId] ?? "") }))
          .filter((e) => e.value === null || e.value > 0)
          .map((e) => ({ memberId: e.memberId, value: e.value ?? -1 }));
      case "SHARES":
        // Sem ajuste, cada pessoa tem 1 parte.
        return ids.map((memberId) => ({ memberId, value: shares[memberId] ?? SHARES_SCALE })).filter((e) => e.value > 0);
      case "ITEMS":
        // Quem aparece em algum item; os valores vêm dos itens.
        return ids.filter((id) => items.some((i) => i.memberIds.includes(id))).map((memberId) => ({ memberId }));
    }
  }, [method, members, participants, exact, percent, shares, items]);

  // Prévia: mesma função e mesma semente (id da despesa) usadas no servidor.
  const preview = useMemo(() => {
    if (itemsMode) {
      if (!itemCalc?.ok) return { ok: false as const, message: itemCalc && itemCalc.itemsMinor > 0 ? itemCalc.message : null };
    } else if (total <= 0) return { ok: false as const, message: null };
    try {
      validatePayers(total, payers);
      const splits = itemsMode && itemCalc?.ok ? itemCalc.shares : computeSplit(total, { method, entries: splitEntries } as SplitRequest, expenseId);
      return { ok: true as const, splits };
    } catch (error) {
      if (error instanceof SplitError || error instanceof PayerError) {
        let message = error.message;
        const diff = error.difference;
        if (diff !== undefined && diff !== 0) {
          if (error.code === "PERCENT_SUM_MISMATCH") {
            message = diff > 0 ? `Faltam ${formatScaled(diff)}% para 100%.` : `Passou ${formatScaled(-diff)}% de 100%.`;
          } else {
            const v = formatMoney(Math.abs(diff), { currency: group.currency });
            message = diff > 0 ? `Faltam ${v} para fechar o total.` : `Passou ${v} do total.`;
          }
        }
        return { ok: false as const, message };
      }
      return { ok: false as const, message: "Confira os valores." };
    }
  }, [itemsMode, itemCalc, total, payers, method, splitEntries, expenseId, group.currency]);

  const summary = useMemo(() => {
    if (!preview.ok) return [];
    const rows = new Map<string, { paid: number; owed: number }>();
    for (const p of payers) rows.set(p.memberId, { paid: p.amountMinor, owed: 0 });
    for (const s of preview.splits) rows.set(s.memberId, { paid: rows.get(s.memberId)?.paid ?? 0, owed: s.amountMinor });
    return [...rows].map(([id, r]) => ({ id, ...r, net: r.paid - r.owed })).sort((a, b) => b.net - a.net);
  }, [preview, payers]);

  const descriptionError = submitted && !description.trim() ? "O que foi essa despesa?" : null;
  const amountError = submitted && total <= 0 ? (itemsMode ? "Adicione os itens com valor." : "Informe o valor.") : null;
  const canSave = total > 0 && description.trim().length > 0 && preview.ok && !pending;

  async function save() {
    setSubmitted(true);
    if (!canSave) return;
    const payload = {
      groupId: group.id,
      description: description.trim(),
      amountMinor: total,
      date,
      category,
      notes: notes.trim() || undefined,
      foreign: foreignOn && foreign ? foreign : undefined,
      payers,
      split: itemsMode
        ? {
            method,
            entries: splitEntries,
            items: items.map((i) => ({ description: i.description.trim() || "Item", amountMinor: i.amountMinor, memberIds: i.memberIds })),
            serviceBp,
            feesMinor,
          }
        : { method, entries: splitEntries },
    };
    const go = () => {
      router.push(editing ? `/grupos/${group.id}/despesas/${expenseId}` : `/grupos/${group.id}`);
      router.refresh();
      onSaved();
    };
    if (initial) {
      await update.run({ ...payload, expenseId, version: initial.version }, { successMessage: "Despesa atualizada", onSuccess: go });
    } else {
      await create.run(
        { ...payload, expenseId, repeat: repeat && !itemsMode ? repeat : undefined },
        {
          onSuccess: () => {
            celebrate({
              title: "Anotado!",
              subtitle: repeat && !itemsMode ? `${description.trim()} vai se repetir ${repeat === "WEEKLY" ? "toda semana" : "todo mês"}.` : `${description.trim()} entrou na conta.`,
              mood: "happy",
            });
            go();
          },
        },
      );
    }
  }

  const CatIcon = expenseCategories[category].icon;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="pb-36"
    >
      {!editing ? (
        <div className="flex justify-center">
          <ReceiptScanner onImport={applyReceipt} />
        </div>
      ) : null}

      {/* Valor */}
      <div className="pt-2 pb-6 text-center">
        <Label htmlFor="amount" className="text-muted-foreground block text-xs font-medium tracking-wide uppercase">
          Quanto foi?
        </Label>
        {foreignOn && foreign ? (
          <>
            <p id="amount" className="font-display mt-1 text-[44px] leading-tight font-black tabular" aria-live="polite">
              {formatMoney(total, { currency: group.currency })}
              <span className="text-muted-foreground block text-xs font-semibold">
                convertido de {formatMoney(foreign.amountMinor, { currency: foreign.currency })}
              </span>
            </p>
            <ForeignCurrencyFields
              groupCurrency={group.currency}
              date={date}
              value={foreign}
              onChange={(update) => setForeign((prev) => (prev ? update(prev) : prev))}
              error={fx?.error ?? null}
            />
          </>
        ) : itemsMode ? (
          <p id="amount" className="font-display mt-1 text-[44px] leading-tight font-black tabular" aria-live="polite">
            {formatMoney(total || (itemCalc && !itemCalc.ok ? itemCalc.itemsMinor : 0), { currency: group.currency })}
            <span className="text-muted-foreground block text-xs font-semibold">soma dos itens, serviço e taxas</span>
          </p>
        ) : (
        <MoneyInput
          id="amount"
          size="hero"
          value={amount}
          currency={group.currency}
          onValueChange={(v) => {
            setAmount(v);
            if (multiPayer && Object.keys(payerAmounts).length === 0) setPayerAmounts({ [viewerMemberId]: v });
          }}
          autoFocus={!editing}
          aria-invalid={amountError ? true : undefined}
          className="mt-1"
        />
        )}
        {amountError ? <p className="text-destructive mt-1 text-sm">{amountError}</p> : null}
        {!itemsMode ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-2 text-sm font-semibold underline-offset-4 hover:underline"
            onClick={() => {
              if (foreign) {
                setForeign(null);
              } else {
                setForeign({ currency: firstForeignCurrency(group.currency), amountMinor: 0, rate: "" });
                setRepeat("");
              }
            }}
          >
            {foreign ? `Voltar para ${group.currency}` : "Paguei em outra moeda"}
          </button>
        ) : null}
      </div>

      {/* Descrição + categoria */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-xl"
            onClick={() => setShowCategories((v) => !v)}
            aria-expanded={showCategories}
            aria-label={`Categoria: ${expenseCategories[category].label}. Alterar`}
          >
            <CatIcon className="size-5" />
          </Button>
          <Input
            id="description"
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            placeholder="Ex.: Supermercado"
            maxLength={120}
            aria-invalid={descriptionError ? true : undefined}
            aria-describedby={descriptionError ? "description-error" : undefined}
          />
        </div>
        {descriptionError ? (
          <p id="description-error" className="text-destructive text-sm">
            {descriptionError}
          </p>
        ) : null}
        <AnimatePresence initial={false}>
          {showCategories ? (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap gap-2 pt-2" role="radiogroup" aria-label="Categoria">
                {(Object.keys(expenseCategories) as ExpenseCategory[]).map((key) => {
                  const { label, icon: Icon } = expenseCategories[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={key === category}
                      onClick={() => {
                        setCategory(key);
                        setCategoryTouched(true);
                        setShowCategories(false);
                      }}
                      className={cn(
                        "focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-2",
                        key === category ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" /> {label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Data e observações */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="bg-card hover:bg-muted focus-within:ring-ring relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm focus-within:ring-2">
          <CalendarDays className="text-muted-foreground size-4" aria-hidden="true" />
          <span className="sr-only">Data da despesa</span>
          <input type="date" value={date} max="2100-12-31" min="2000-01-01" onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent outline-none" />
        </label>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="bg-card hover:bg-muted focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-2"
          aria-expanded={showMore}
        >
          <StickyNote className="text-muted-foreground size-4" aria-hidden="true" /> Observação
        </button>
        {!editing && !itemsMode && !foreignOn ? (
          <label className="bg-card hover:bg-muted focus-within:ring-ring relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm focus-within:ring-2">
            <Repeat className="text-muted-foreground size-4" aria-hidden="true" />
            <span className="sr-only">Repetir</span>
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)} className="bg-transparent outline-none">
              <option value="">Não repete</option>
              <option value="WEEKLY">Toda semana</option>
              <option value="MONTHLY">Todo mês</option>
            </select>
          </label>
        ) : null}
      </div>
      {repeat && !itemsMode && !editing ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Lançamos sozinhos {repeat === "WEEKLY" ? "toda semana, no mesmo dia da semana" : `todo dia ${Number(date.slice(8, 10))} (ou no último dia do mês, se for mais curto)`}, com o mesmo valor e a
          mesma divisão. Dá para pausar nas configurações do grupo.
        </p>
      ) : null}
      {showMore ? (
        <div className="mt-3">
          <Label htmlFor="notes" className="sr-only">
            Observações
          </Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Algo a lembrar sobre essa despesa?" maxLength={1000} rows={2} />
        </div>
      ) : null}

      {/* Quem pagou */}
      <section className="mt-8" aria-labelledby="payers-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="payers-title" className="text-sm font-semibold">
            Quem pagou?
          </h2>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-sm font-medium underline-offset-4 hover:underline"
            onClick={() => {
              setMultiPayer((v) => !v);
              if (!multiPayer) setPayerAmounts({ [singlePayer]: total });
            }}
          >
            {multiPayer ? "Só uma pessoa" : "Mais de uma pessoa"}
          </button>
        </div>
        {!multiPayer ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-labelledby="payers-title">
            {ordered.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={singlePayer === m.id}
                onClick={() => setSinglePayer(m.id)}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-11 shrink-0 items-center gap-2 rounded-full border pr-4 pl-1.5 text-sm font-medium outline-none focus-visible:ring-2",
                  singlePayer === m.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                <MemberAvatar name={m.name} colorKey={m.id} imageUrl={m.imageUrl} size="sm" className="size-8" />
                {m.id === viewerMemberId ? "Você" : m.name}
              </button>
            ))}
          </div>
        ) : (
          <ul className="bg-card divide-y rounded-2xl border shadow-card">
            {ordered.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                <MemberAvatar name={m.name} colorKey={m.id} imageUrl={m.imageUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{nameOf(m.id)}</span>
                <MoneyInput
                  value={payerAmounts[m.id] ?? 0}
                  currency={group.currency}
                  onValueChange={(v) => setPayerAmounts((p) => ({ ...p, [m.id]: v }))}
                  aria-label={`Quanto ${nameOf(m.id)} pagou`}
                  className="h-10 w-36 text-right"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Divisão */}
      <section className="mt-8" aria-labelledby="split-title">
        <h2 id="split-title" className="mb-3 text-sm font-semibold">
          Como dividir?
        </h2>
        <SplitMethodPicker value={method} onChange={setMethod} />
        {itemsMode ? (
          <div className="mt-3">
            <ItemsEditor
              items={items}
              onItems={setItems}
              serviceBp={serviceBp}
              onServiceBp={setServiceBp}
              feesMinor={feesMinor}
              onFees={setFeesMinor}
              members={ordered}
              viewerMemberId={viewerMemberId}
              currency={group.currency}
            />
            {itemCalc?.ok ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Itens <Money amountMinor={itemCalc.itemsMinor} currency={group.currency} /> · serviço <Money amountMinor={itemCalc.serviceMinor} currency={group.currency} />
                {itemCalc.feesMinor > 0 ? (
                  <>
                    {" "}· taxas <Money amountMinor={itemCalc.feesMinor} currency={group.currency} />
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : (
        <ul className="bg-card mt-3 divide-y rounded-2xl border shadow-card">
          {ordered.map((m) => {
            const share = preview.ok ? preview.splits.find((s) => s.memberId === m.id)?.amountMinor : undefined;
            return (
              <li key={m.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                {method === "EQUAL" ? (
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={participants.has(m.id)}
                      onChange={(e) =>
                        setParticipants((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        })
                      }
                      className="accent-primary size-5 rounded"
                    />
                    <MemberAvatar name={m.name} colorKey={m.id} imageUrl={m.imageUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">{nameOf(m.id)}</span>
                    <span className="text-muted-foreground tabular text-sm">{share !== undefined && participants.has(m.id) ? formatMoney(share, { currency: group.currency }) : "—"}</span>
                  </label>
                ) : (
                  <>
                    <MemberAvatar name={m.name} colorKey={m.id} imageUrl={m.imageUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">{nameOf(m.id)}</span>
                    {method === "EXACT" ? (
                      <MoneyInput
                        value={exact[m.id] ?? 0}
                        currency={group.currency}
                        onValueChange={(v) => setExact((p) => ({ ...p, [m.id]: v }))}
                        aria-label={`Valor de ${nameOf(m.id)}`}
                        className="h-10 w-36 text-right"
                      />
                    ) : method === "PERCENT" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular w-20 text-right text-xs">{share !== undefined ? formatMoney(share, { currency: group.currency }) : ""}</span>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            value={percent[m.id] ?? ""}
                            onChange={(e) => setPercent((p) => ({ ...p, [m.id]: e.target.value }))}
                            placeholder="0"
                            aria-label={`Porcentagem de ${nameOf(m.id)}`}
                            className="tabular h-10 w-24 pr-7 text-right"
                          />
                          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular w-20 text-right text-xs">{share !== undefined ? formatMoney(share, { currency: group.currency }) : ""}</span>
                        <div className="flex items-center rounded-xl border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Menos uma parte para ${nameOf(m.id)}`}
                            onClick={() => setShares((p) => ({ ...p, [m.id]: Math.max(0, (p[m.id] ?? SHARES_SCALE) - SHARES_SCALE) }))}
                          >
                            <Minus />
                          </Button>
                          <span className="tabular w-8 text-center text-sm font-semibold" aria-live="polite">
                            {formatScaled(shares[m.id] ?? SHARES_SCALE)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Mais uma parte para ${nameOf(m.id)}`}
                            onClick={() => setShares((p) => ({ ...p, [m.id]: Math.min(100_000, (p[m.id] ?? SHARES_SCALE) + SHARES_SCALE) }))}
                          >
                            <Plus />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        )}
        {method === "PERCENT" && Object.keys(percent).length === 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              // Preenche partes iguais em pontos-base, resto no primeiro.
              const n = members.length;
              const base = Math.floor(PERCENT_SCALE / n);
              setPercent(Object.fromEntries(ordered.map((m, i) => [m.id, formatScaled(base + (i === 0 ? PERCENT_SCALE - base * n : 0))])));
            }}
          >
            <Users /> Distribuir igualmente
          </Button>
        ) : null}
      </section>

      {/* Resumo antes de salvar */}
      <section className="mt-8" aria-live="polite" aria-labelledby="summary-title">
        <h2 id="summary-title" className="mb-3 text-sm font-semibold">
          Resumo
        </h2>
        {preview.ok ? (
          <ul className="bg-muted/60 space-y-3 rounded-2xl p-4">
            {summary.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{nameOf(r.id)}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    pagou <Money amountMinor={r.paid} currency={group.currency} /> · parte <Money amountMinor={r.owed} currency={group.currency} />
                  </p>
                </div>
                {r.net === 0 ? (
                  <span className="text-muted-foreground shrink-0">quite</span>
                ) : (
                  <span className={cn("shrink-0 text-right font-semibold", r.net > 0 ? "text-positive" : "text-negative")}>
                    <span className="block text-[11px] font-medium">{r.net > 0 ? "recebe" : "deve"}</span>
                    <Money amountMinor={r.net} currency={group.currency} absolute tone="auto" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn("rounded-2xl p-4 text-sm", preview.message ? "bg-warning-soft text-warning" : "bg-muted/60 text-muted-foreground")}>
            {preview.message ?? (itemsMode ? "Adicione os itens para ver quanto cada um paga." : "Informe o valor para ver como fica a divisão.")}
          </p>
        )}
      </section>

      {/* Salvar */}
      <div className="bg-background/90 pb-safe fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-lg md:left-64">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-muted-foreground truncate text-xs">{group.name}</p>
            <p className="truncate font-semibold">{total > 0 ? formatMoney(total, { currency: group.currency }) : "—"}</p>
          </div>
          <Button type="submit" size="lg" disabled={pending || (submitted && !canSave)} className="min-w-40">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            {editing ? "Salvar alterações" : "Salvar despesa"}
          </Button>
        </div>
      </div>
    </form>
  );
}
