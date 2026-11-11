"use server";

import { z } from "zod";
import { authedAction } from "./safe-action";
import { idSchema } from "@/schemas/common";
import { createExpenseSchema, expenseRefSchema, updateExpenseSchema } from "@/schemas/expense";
import { createSettlementSchema, settlementRefSchema } from "@/schemas/settlement";
import * as expenses from "@/server/services/expenses";
import * as settlements from "@/server/services/settlements";
import { getMemberPixKeys } from "@/server/services/profile";
import { enforceRateLimit } from "@/server/rate-limit";
import * as reminders from "@/server/services/reminders";
import * as nfce from "@/server/services/nfce";
import * as fx from "@/server/services/fx";

export const createExpenseAction = authedAction("expense.create", createExpenseSchema, async (input, viewer) => {
  await enforceRateLimit(`expense:${viewer.userId}`, 120, 3600);
  return expenses.createExpense(viewer, input);
});
export const updateExpenseAction = authedAction("expense.update", updateExpenseSchema, (input, viewer) => expenses.updateExpense(viewer, input));
export const deleteExpenseAction = authedAction("expense.delete", expenseRefSchema, (input, viewer) => expenses.deleteExpense(viewer, input));
export const restoreExpenseAction = authedAction("expense.restore", expenseRefSchema, (input, viewer) => expenses.restoreExpense(viewer, input));

export const createSettlementAction = authedAction("settlement.create", createSettlementSchema, async (input, viewer) => {
  await enforceRateLimit(`settlement:${viewer.userId}`, 60, 3600);
  return settlements.createSettlement(viewer, input);
});
export const confirmSettlementAction = authedAction("settlement.confirm", settlementRefSchema, (input, viewer) => settlements.confirmSettlement(viewer, input));
export const rejectSettlementAction = authedAction("settlement.reject", settlementRefSchema, (input, viewer) => settlements.rejectSettlement(viewer, input));
export const deleteSettlementAction = authedAction("settlement.delete", settlementRefSchema, (input, viewer) => settlements.deleteSettlement(viewer, input));

export const getPixKeysAction = authedAction("pix.read", z.object({ groupId: idSchema, memberId: idSchema }), (input, viewer) =>
  getMemberPixKeys(viewer, input.groupId, input.memberId),
);

export const sendReminderAction = authedAction("reminder.send", reminders.reminderSchema, async (input, viewer) => {
  await enforceRateLimit(`reminder:${viewer.userId}`, 30, 3600);
  return reminders.sendPaymentReminder(viewer, input);
});

export const readNfceAction = authedAction("nfce.read", nfce.readNfceSchema, (input, viewer) => nfce.readNfce(viewer, input));
export const suggestRateAction = authedAction("fx.suggest", fx.rateQuerySchema, (input, viewer) => fx.suggestRate(viewer, input));
