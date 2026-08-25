import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import { emitGroupCreated } from "../../socket";
import type { AuthData } from "../../context/LoginData";

export interface GroupPermissionsInput {
  editGroupSettings?: boolean;
  editGroupAdmins?: boolean;
  sendMessages?: boolean;
  addOtherMembers?: boolean;
  approveNewMembers?: boolean;
  AllowDeleteForAll?: boolean;
}

export interface GroupMemberInput {
  UserId?: number | string;
  userId?: number | string;
  id?: number | string;
  name?: string;
  [key: string]: unknown;
}

export interface CreateGroupParams {
  userId?: number | string;
  groupName: string;
  groupDesc: string;
  groupProfile?: string;
  permissions?: GroupPermissionsInput;
  groupMembers?: GroupMemberInput[] | string;
  fLabel?: string;
}

export const createGroupApi = async (
  auth: AuthData,
  {
    userId,
    groupName,
    groupDesc,
    groupProfile = "",
    permissions = {},
    groupMembers = [],
    fLabel = "Group ( CreateGroup )",
  }: CreateGroupParams
): Promise<any> => {
  try {
    if (!auth) {
      throw new Error("auth is required for createGroupApi");
    }

    const {
      editGroupSettings = true,
      sendMessages = true,
      addOtherMembers = true,
      approveNewMembers = false,
      AllowDeleteForAll = true,
    } = permissions;

    const payload = {
      UserId: userId ?? auth?.id ?? 0,
      GroupName: groupName,
      GroupDesc: groupDesc,
      GroupProfile: groupProfile,
      EditGroup: editGroupSettings ? 1 : 0,
      SendNewMessage: sendMessages ? 1 : 0,
      AddOtherMember: addOtherMembers ? 1 : 0,
      AllowDeleteForAll: AllowDeleteForAll ? 1 : 0,
      GroupMembers: Array.isArray(groupMembers)
        ? JSON.stringify(groupMembers)
        : groupMembers ?? "[]",
    };

    const body = buildCommonBody("CreateGroup", auth, payload, fLabel);
    const response = await CommonAPI(body);

    const rd =
      response?.Data?.rd?.[0] ||
      (Array.isArray(response?.rd) ? response.rd[0] : response?.Data?.rd || response?.rd);

    const enrichedRd = { ...rd, SystemMsg: 1 };
    const convId = rd?.ConversationId || response?.rd?.ConversationId;

    if (response?.Status === "200" && convId) {
      const memberIds = Array.isArray(groupMembers)
        ? groupMembers.map((m) => Number(m.UserId || m.userId || m.id))
        : [];

      emitGroupCreated({
        ufcc: auth?.ufcc,
        eventType: "group_created",
        conversationId: convId,
        ReceiverId: memberIds,
        groupName,
        groupDesc,
        groupProfile,
        conversationData: enrichedRd,
        createdBy: {
          userId: auth?.id || auth?.userId,
          name: auth?.username || (auth as { name?: string }).name,
          email: (auth as { email?: string }).email,
        },
        members: groupMembers,
        permissions: {
          editGroupSettings: editGroupSettings ? 1 : 0,
          sendMessages: sendMessages ? 1 : 0,
          addOtherMembers: addOtherMembers ? 1 : 0,
          approveNewMembers: approveNewMembers ? 1 : 0,
        },
        timestamp: new Date().toISOString(),
        receiveEvent: "internal:group_created",
      });
    }

    return response;
  } catch (error) {
    console.error("createGroupApi Error:", error);
    return null;
  }
};
