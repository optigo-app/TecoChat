import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import { emitGroupUpdated } from "../../socket";
import { getGroupMemberIds } from "../../utils/groupSocketHelpers";
import type { AuthData } from "../../context/LoginData";

export interface EditGroupParams {
  conversationId: number | string;
  groupName: string;
  groupDesc: string;
  groupProfile?: string;
}

export const editGroupApi = async (
  auth: AuthData,
  { conversationId, groupName, groupDesc, groupProfile = "" }: EditGroupParams
): Promise<any> => {
  try {
    const payload = {
      UserId: Number(auth?.id ?? auth?.userId),
      ConversationId: Number(conversationId),
      GroupName: groupName,
      GroupDesc: groupDesc,
      GroupProfile: groupProfile,
    };

    const body = buildCommonBody("EditGroup", auth, payload, "Group ( EditGroup )");
    const response = await CommonAPI(body);

    if (response?.Status === "200") {
      const rd =
        response?.Data?.rd?.[0] ||
        (Array.isArray(response?.rd) ? response.rd[0] : response?.Data?.rd || response?.rd);

      if (rd?.stat === 0) {
        return response;
      }

      const memberIds = await getGroupMemberIds(conversationId, auth);

      const changes: Record<string, string> = {};
      if (groupName) changes.groupName = groupName;
      if (groupDesc) changes.groupDesc = groupDesc;
      if (groupProfile) changes.groupProfile = groupProfile;

      const enrichedRd = {
        ...rd,
        ConversationId: Number(conversationId),
        ConversationName: groupName || rd?.ConversationName,
        GroupDesc: groupDesc || rd?.GroupDesc,
        ProfileImageUrl: groupProfile || rd?.ProfileImageUrl,
      };

      emitGroupUpdated({
        ufcc: auth?.ufcc,
        eventType: "group_updated",
        conversationId: Number(conversationId),
        ReceiverId: memberIds,
        conversationData: enrichedRd,
        updatedBy: {
          userId: auth?.id || auth?.userId,
          name: auth?.username || (auth as { name?: string }).name,
          email: (auth as { email?: string }).email,
        },
        changes,
        timestamp: new Date().toISOString(),
      });
    }

    return response;
  } catch (error) {
    console.error("Error editing group:", error);
    return null;
  }
};
