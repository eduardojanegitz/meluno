import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { createExpense } from "@/server/services/expenses";
import { deleteReceipt, getReceipt, putReceipt } from "@/server/services/receipts";
import { generateDueRecurring, listRecurring, manageRecurring, occurrenceId } from "@/server/services/recurring";
import { exportGroupCsv } from "@/server/services/group-export";
import { idSchema } from "@/schemas/common";
import { createTestDb, resetDb } from "../support/db";
import { makeGroup, makeUser, memberOf } from "../support/factories";

const admin = createTestDb();
const code = (c: string) => (e: unknown) => e instanceof AppError && e.code === c;

// JPEG mínimo com EXIF ("GPS") que o servidor precisa remover.
const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const bytes = (s: string) => [...Buffer.from(s, "latin1")];
const JPEG = Uint8Array.from([0xff, 0xd8, ...seg(0xe1, bytes("Exif\0\0GPS-23.5")), ...seg(0xdb, [0, 1]), ...seg(0xda, [1, 1, 0]), 0x11, 0x22, 0xff, 0xd9]);

describe("comprovante, recorrência e planilha (integração)", () => {
  beforeEach(() => resetDb(admin));
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  async function setup() {
    const ana = await makeUser("Ana");
    const bia = await makeUser("Bia");
    const caio = await makeUser("Caio");
    const g = await makeGroup(ana, [bia, caio], "Apê");
    return { ana, bia, caio, g, ma: await memberOf(ana, g), mb: await memberOf(bia, g), mc: await memberOf(caio, g) };
  }

  const equal = (groupId: string, payer: string, ids: string[], extra: Partial<Parameters<typeof createExpense>[1]> = {}) => ({
    groupId,
    expenseId: randomUUID(),
    description: "Aluguel",
    amountMinor: 300000,
    date: "2026-01-31",
    payers: [{ memberId: payer, amountMinor: 300000 }],
    split: { method: "EQUAL" as const, entries: ids.map((memberId) => ({ memberId })) },
    ...extra,
  });

  describe("comprovante", () => {
    it("guarda o JPEG sem EXIF; só membros veem; só quem lançou, pagou ou admin anexa", async () => {
      const { ana, bia, caio, g, ma, mb, mc } = await setup();
      const { expenseId } = await createExpense(bia, equal(g, mb.id, [ma.id, mb.id, mc.id]));

      await expect(putReceipt(caio, g, expenseId, JPEG)).rejects.toSatisfy(code("FORBIDDEN")); // nem lançou nem pagou
      await putReceipt(bia, g, expenseId, JPEG); // lançou e pagou
      await putReceipt(ana, g, expenseId, JPEG); // admin

      const r = await getReceipt(caio, g, expenseId);
      expect(r.contentType).toBe("image/jpeg");
      expect(Buffer.from(r.data).toString("latin1")).not.toContain("GPS");
      expect([...r.data.subarray(0, 2)]).toEqual([0xff, 0xd8]);

      const intrusa = await makeUser("Intrusa");
      await expect(getReceipt(intrusa, g, expenseId)).rejects.toSatisfy(code("NOT_FOUND"));

      await deleteReceipt(bia, g, expenseId);
      await expect(getReceipt(ana, g, expenseId)).rejects.toSatisfy(code("NOT_FOUND"));
    });

    it("recusa o que não é JPEG e arquivos grandes; o banco também barra", async () => {
      const { ana, g, ma } = await setup();
      const { expenseId } = await createExpense(ana, equal(g, ma.id, [ma.id]));
      await expect(putReceipt(ana, g, expenseId, Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2]))).rejects.toSatisfy(code("VALIDATION"));
      await expect(putReceipt(ana, g, expenseId, new Uint8Array(1_600_000))).rejects.toSatisfy(code("VALIDATION"));
      await expect(
        admin.$executeRawUnsafe(`INSERT INTO expense_receipt ("expenseId","contentType","data","sizeBytes","uploadedByMemberId") VALUES ('${expenseId}','image/png','\\x00',1,'${ma.id}')`),
      ).rejects.toThrow(/jpeg_only/);
    });
  });

  describe("despesas recorrentes", () => {
    it("mensal no dia 31: 28/fev e 31/mar; rodar de novo não duplica", async () => {
      const { ana, g, ma, mb } = await setup();
      await createExpense(ana, { ...equal(g, ma.id, [ma.id, mb.id]), repeat: "MONTHLY" });
      const [t] = await listRecurring(ana, g);
      expect(t).toMatchObject({ frequency: "MONTHLY", nextDate: "2026-02-28", status: "ACTIVE", canManage: true });

      const now = new Date("2026-03-31T12:00:00Z");
      expect(await generateDueRecurring(now)).toMatchObject({ created: 2, paused: 0 });
      expect(await generateDueRecurring(now)).toMatchObject({ due: 0, created: 0 });

      const dates = (await db.expense.findMany({ where: { groupId: g }, orderBy: { date: "asc" }, select: { date: true, recurringExpenseId: true } })).map((e) => e.date.toISOString().slice(0, 10));
      expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
      expect((await listRecurring(ana, g))[0]!.nextDate).toBe("2026-04-30");
    });

    it("alguém da divisão sai: pausa e avisa quem criou; retomar pula as datas perdidas", async () => {
      const { ana, bia, g, ma, mb, mc } = await setup();
      await createExpense(ana, { ...equal(g, ma.id, [ma.id, mb.id, mc.id]), date: "2026-01-10", repeat: "MONTHLY" });
      await db.groupMember.update({ where: { id: mc.id }, data: { status: "LEFT", leftAt: new Date() } });

      expect(await generateDueRecurring(new Date("2026-02-10T12:00:00Z"))).toMatchObject({ created: 0, paused: 1 });
      const [t] = await listRecurring(ana, g);
      expect(t).toMatchObject({ status: "PAUSED", pausedReason: expect.stringContaining("saiu do grupo") });
      expect(await db.notification.findFirst({ where: { userId: ana.userId, type: "RECURRING_PAUSED" } })).not.toBeNull();

      // Bia não criou nem é admin.
      await expect(manageRecurring(bia, { groupId: g, recurringId: t!.id, action: "resume" })).rejects.toSatisfy(code("FORBIDDEN"));
      await manageRecurring(ana, { groupId: g, recurringId: t!.id, action: "resume" }, new Date("2026-04-20T12:00:00Z"));
      expect((await listRecurring(ana, g))[0]).toMatchObject({ status: "ACTIVE", nextDate: "2026-05-10" });

      await manageRecurring(ana, { groupId: g, recurringId: t!.id, action: "delete" });
      expect(await listRecurring(ana, g)).toEqual([]);
      expect(await db.expense.count({ where: { groupId: g } })).toBe(1); // a já lançada continua
    });

    it("divisão por item não pode se repetir; id das ocorrências é UUID válido e estável", async () => {
      const { ana, g, ma } = await setup();
      await expect(
        createExpense(ana, {
          ...equal(g, ma.id, [ma.id]),
          amountMinor: 1000,
          payers: [{ memberId: ma.id, amountMinor: 1000 }],
          split: { method: "ITEMS", entries: [{ memberId: ma.id }], items: [{ description: "x", amountMinor: 1000, memberIds: [ma.id] }], serviceBp: 0, feesMinor: 0 },
          repeat: "WEEKLY",
        }),
      ).rejects.toThrow();
      const id = occurrenceId(randomUUID(), "2026-02-01");
      expect(idSchema.safeParse(id).success).toBe(true);
      expect(occurrenceId("a", "2026-02-01")).toBe(occurrenceId("a", "2026-02-01"));
      expect(occurrenceId("a", "2026-02-01")).not.toBe(occurrenceId("a", "2026-02-02"));
    });
  });

  describe("planilha do grupo", () => {
    it("uma coluna por pessoa, vírgula decimal, fórmulas neutralizadas; só para membros", async () => {
      const { ana, g, ma, mb, mc } = await setup();
      await createExpense(ana, { ...equal(g, ma.id, [ma.id, mb.id, mc.id]), description: "=SOMA(A1)", amountMinor: 10000, payers: [{ memberId: ma.id, amountMinor: 10000 }] });
      const { csv, filename } = await exportGroupCsv(ana, g);
      expect(filename).toBe("meluno-ape.csv");
      const [header, row] = csv.replace(/^﻿/, "").split("\r\n");
      expect(header).toBe("Data;Tipo;Descrição;Categoria;Divisão;Valor (BRL);Pago por;Parte de Ana;Parte de Bia;Parte de Caio;Observações");
      expect(row).toMatch(/^2026-01-31;Despesa;'=SOMA\(A1\);Outros;igual;100,00;Ana;33,3[34];33,3[34];33,3[34];$/);

      const intrusa = await makeUser("Intrusa");
      await expect(exportGroupCsv(intrusa, g)).rejects.toSatisfy(code("NOT_FOUND"));
    });
  });
});
