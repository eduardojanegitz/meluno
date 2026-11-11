"use server";

import { z } from "zod";
import { authedAction } from "./safe-action";
import { idSchema } from "@/schemas/common";
import * as profile from "@/server/services/profile";
import { markNotificationsRead } from "@/server/services/queries";

export const updateProfileAction = authedAction("profile.update", profile.updateProfileSchema, (input, viewer) => profile.updateProfile(viewer, input));
export const addPixKeyAction = authedAction("pix.add", profile.pixKeySchema, (input, viewer) => profile.addPixKey(viewer, input));
export const removePixKeyAction = authedAction("pix.remove", z.object({ id: idSchema }), (input, viewer) => profile.removePixKey(viewer, input.id));
export const markNotificationsReadAction = authedAction("notifications.read", z.object({}), (_input, viewer) => markNotificationsRead(viewer));
