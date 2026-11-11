"use server";

import { z } from "zod";
import { authedAction } from "./safe-action";
import { idSchema } from "@/schemas/common";
import * as profile from "@/server/services/profile";
import { markNotificationsRead } from "@/server/services/queries";
import { enforceRateLimit } from "@/server/rate-limit";
import { cookies, headers } from "next/headers";
import { auth } from "@/server/auth/auth";
import { AppError } from "@/server/errors";
import * as account from "@/server/services/account";
import * as push from "@/server/services/push";

export const updateProfileAction = authedAction("profile.update", profile.updateProfileSchema, (input, viewer) => profile.updateProfile(viewer, input));
export const addPixKeyAction = authedAction("pix.add", profile.pixKeySchema, async (input, viewer) => {
  await enforceRateLimit(`pix:${viewer.userId}`, 20, 3600);
  return profile.addPixKey(viewer, input);
});
export const removePixKeyAction = authedAction("pix.remove", z.object({ id: idSchema }), (input, viewer) => profile.removePixKey(viewer, input.id));
export const updateNotificationPrefsAction = authedAction("notifications.prefs", profile.notificationPrefsSchema, (input, viewer) =>
  profile.updateNotificationPrefs(viewer, input),
);
export const subscribePushAction = authedAction("push.subscribe", push.subscribeSchema, async (input, viewer) => {
  await enforceRateLimit(`push-sub:${viewer.userId}`, 20, 3600);
  return push.subscribePush(viewer, input);
});
export const unsubscribePushAction = authedAction("push.unsubscribe", push.endpointSchema, (input, viewer) => push.unsubscribePush(viewer, input));
export const testPushAction = authedAction("push.test", push.endpointSchema, async (input, viewer) => {
  await enforceRateLimit(`push-test:${viewer.userId}`, 5, 600);
  return push.testPush(viewer, input);
});
export const markNotificationsReadAction = authedAction("notifications.read", z.object({}), (_input, viewer) => markNotificationsRead(viewer));

export const deleteAccountAction = authedAction("account.delete", account.deleteAccountSchema, async (input, viewer) => {
  await enforceRateLimit(`account-delete:${viewer.userId}`, 5, 3600);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AppError("UNAUTHENTICATED");
  await account.deleteAccount(viewer, input, { sessionCreatedAt: new Date(session.session.createdAt) });

  // As sessões já foram apagadas no banco; remove os cookies para o navegador não insistir num login morto.
  const { authCookies } = await auth.$context;
  const jar = await cookies();
  for (const c of [authCookies.sessionToken, authCookies.sessionData, authCookies.accountData, authCookies.dontRememberToken]) {
    jar.delete(c.name);
  }
  return { deleted: true as const };
});
