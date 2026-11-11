import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createExpense } from "@/server/services/expenses";
import { createSettlement } from "@/server/services/settlements";
import { addPixKey, getMemberPixKeys, updateProfile } from "@/server/services/profile";
import { exportMyData } from "@/server/services/data-export";
import { createTestDb, resetDb } from "../support/db";
import { makeGroup, makeUser, memberOf } from "../support/factories";

const admin = createTestDb();

describe("LGPD: exportação dos dados e cidade do Pix", () => {
  beforeEach(() => resetDb(admin));
  afterAll(async () => {
    await admin.$disconnect();
    await db.$disconnect();
  });

  async function setup() {
    const ana = await makeUser("Ana");
    const bia = await makeUser("Bia");
    const g = await makeGroup(ana, [bia], "Viagem");
    return { ana, bia, g, ma: await memberOf(ana, g), mb: await memberOf(bia, g) };
  }

  it("exporta a parte da pessoa em cada despesa, sem a parte dos outros e sem segredos", async () => {
    const { ana, bia, g, ma, mb } = await setup();
    await createExpense(ana, {
      groupId: g,
      expenseId: randomUUID(),
      description: "Hotel",
      amountMinor: 30000,
      date: "2026-11-01",
      notes: "duas diárias",
      payers: [{ memberId: ma.id, amountMinor: 30000 }],
      split: { method: "EXACT", entries: [{ memberId: ma.id, value: 10000 }, { memberId: mb.id, value: 20000 }] },
    });
    await createSettlement(bia, { groupId: g, idempotencyKey: randomUUID().replace(/-/g, ""), fromMemberId: mb.id, toMemberId: ma.id, amountMinor: 5000, date: "2026-11-02", method: "PIX" });
    await addPixKey(ana, { type: "EMAIL", value: "ana@example.test" });

    const data = await exportMyData(ana);
    const json = JSON.stringify(data);

    expect(data.account).toMatchObject({ name: "Ana", email: ana.email });
    expect(data.pixKeys).toHaveLength(1);
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]!.expenses).toEqual([
      expect.objectContaining({ description: "Hotel", date: "2026-11-01", totalMinor: 30000, youPaidMinor: 30000, yourShareMinor: 10000, createdByYou: true, notes: "duas diárias" }),
    ]);
    expect(data.groups[0]!.settlements).toEqual([expect.objectContaining({ direction: "received", counterpart: "Bia", amountMinor: 5000 })]);

    // Nada de hash de senha, tokens de sessão/OAuth nem e-mail de outras pessoas.
    expect(json).not.toMatch(/"password"|"token"|accessToken|refreshToken|idToken/);
    expect(json).not.toContain(bia.email);
    expect(json).not.toContain("20000"); // a parte da Bia
  });

  it("a cidade salva no perfil vai junto com as chaves Pix para quem vai pagar", async () => {
    const { ana, bia, g, ma } = await setup();
    await addPixKey(ana, { type: "EMAIL", value: "ana@example.test" });
    await updateProfile(ana, { name: "Ana", defaultCurrency: "BRL", emailOnExpense: false, emailOnSettlement: true, emailOnInvitation: true, pixCity: "  São Paulo " });
    expect(await getMemberPixKeys(bia, g, ma.id)).toEqual([expect.objectContaining({ value: "ana@example.test", city: "São Paulo" })]);

    // Campo vazio apaga a cidade; omitir o campo mantém o que havia.
    await updateProfile(ana, { name: "Ana", defaultCurrency: "BRL", emailOnExpense: false, emailOnSettlement: true, emailOnInvitation: true, pixCity: "" });
    expect((await getMemberPixKeys(bia, g, ma.id))[0]!.city).toBeNull();
    await updateProfile(ana, { name: "Ana", defaultCurrency: "BRL", emailOnExpense: false, emailOnSettlement: true, emailOnInvitation: true, pixCity: "Recife" });
    await updateProfile(ana, { name: "Ana", defaultCurrency: "BRL", emailOnExpense: false, emailOnSettlement: true, emailOnInvitation: true });
    expect((await getMemberPixKeys(bia, g, ma.id))[0]!.city).toBe("Recife");
  });
});
