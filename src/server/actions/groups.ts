"use server";

import { z } from "zod";
import { authedAction } from "./safe-action";
import * as recurring from "@/server/services/recurring";
import * as spending from "@/server/services/spending";
import { idSchema } from "@/schemas/common";
import { addMemberSchema, changeRoleSchema, createGroupSchema, createInvitationSchema, invitationTokenSchema, memberActionSchema, updateGroupSchema } from "@/schemas/group";
import * as groups from "@/server/services/groups";
import * as invitations from "@/server/services/invitations";
import { enforceRateLimit } from "@/server/rate-limit";

export const createGroupAction = authedAction("group.create", createGroupSchema, async (input, viewer) => {
  await enforceRateLimit(`group:${viewer.userId}`, 20, 3600);
  return groups.createGroup(viewer, input);
});
export const updateGroupAction = authedAction("group.update", updateGroupSchema, (input, viewer) => groups.updateGroup(viewer, input));
export const archiveGroupAction = authedAction("group.archive", z.object({ groupId: idSchema, archived: z.boolean() }), (input, viewer) =>
  groups.setGroupArchived(viewer, input.groupId, input.archived),
);
export const addMemberAction = authedAction("group.add_member", addMemberSchema, async (input, viewer) => {
  await enforceRateLimit(`member:${viewer.userId}`, 60, 3600);
  return groups.addProvisionalMember(viewer, input);
});
export const removeMemberAction = authedAction("group.remove_member", memberActionSchema, (input, viewer) => groups.removeMember(viewer, input));
export const changeRoleAction = authedAction("group.change_role", changeRoleSchema, (input, viewer) => groups.changeMemberRole(viewer, input));
export const leaveGroupAction = authedAction("group.leave", z.object({ groupId: idSchema }), (input, viewer) => groups.leaveGroup(viewer, input.groupId));

export const createInvitationAction = authedAction("invite.create", createInvitationSchema, (input, viewer) => invitations.createInvitation(viewer, input));
export const revokeInvitationAction = authedAction("invite.revoke", z.object({ groupId: idSchema, invitationId: idSchema }), (input, viewer) =>
  invitations.revokeInvitation(viewer, input.groupId, input.invitationId),
);
export const acceptInvitationAction = authedAction("invite.accept", invitationTokenSchema, async (input, viewer) => {
  await enforceRateLimit(`invite-accept:${viewer.userId}`, 30, 3600);
  return invitations.acceptInvitation(viewer, input.token);
});
export const acceptInvitationByIdAction = authedAction("invite.accept_by_id", z.object({ invitationId: idSchema }), (input, viewer) =>
  invitations.acceptInvitationById(viewer, input.invitationId),
);
export const declineInvitationAction = authedAction("invite.decline", z.object({ invitationId: idSchema }), (input, viewer) =>
  invitations.declineInvitation(viewer, input.invitationId),
);
export const getGroupSummaryAction = authedAction("group.summary", z.object({ groupId: idSchema }), (input, viewer) => groups.getGroupSummary(viewer, input.groupId));
export const closeGroupAction = authedAction("group.close", z.object({ groupId: idSchema }), (input, viewer) => groups.closeGroup(viewer, input.groupId));

export const manageRecurringAction = authedAction("recurring.manage", recurring.recurringActionSchema, (input, viewer) => recurring.manageRecurring(viewer, input));
export const getSpendingAction = authedAction("spending.read", spending.spendingSchema, (input, viewer) => spending.getGroupSpending(viewer, input));
