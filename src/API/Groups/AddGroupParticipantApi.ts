import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import { emitMemberAdded } from "../../socket";
import { getGroupMemberIds } from "../../utils/groupSocketHelpers";
import type { AuthData } from "../../context/LoginData";

export interface AddGroupParticipantParams {
  conversationId: number | string;
  selectedMembers: (number | string)[];
  newMembersData?: Array<{ userId?: number | string; name?: string }>;
}

export const addGroupParticipantApi = async (
  auth: AuthData,
  { conversationId, selectedMembers, newMembersData = [] }: AddGroupParticipantParams
): Promise<any> => {
  try {
    const payload = {
      UserId: Number(auth?.id ?? auth?.userId),
      ConversationId: Number(conversationId),
      GroupMembers: JSON.stringify(
        selectedMembers?.map((id) => ({ UserId: id }))
      ),
    };

    const body = buildCommonBody("AddMembers", auth, payload, "Group ( AddMembers )");
    const response = await CommonAPI(body);

    if (response?.Status === "200") {
      const rd =
        response?.Data?.rd?.[0] ||
        (Array.isArray(response?.rd) ? response.rd[0] : response?.Data?.rd || response?.rd);

      if (rd?.stat === 0) {
        return response;
      }

      const allMemberIds = await getGroupMemberIds(conversationId, auth);
      const broadcastIds = Array.from(
        new Set([...allMemberIds, ...selectedMembers.map((id) => Number(id))])
      );

      const enrichedRd = {
        ...rd,
        ConversationId: Number(conversationId),
        SystemMsg: 1,
      };

      emitMemberAdded({
        ufcc: auth?.ufcc,
        eventType: "member_added",
        conversationId: Number(conversationId),
        ReceiverId: broadcastIds,
        conversationData: enrichedRd,
        addedBy: {
          userId: auth?.id || auth?.userId,
          name: auth?.username || (auth as { name?: string }).name,
          email: (auth as { email?: string }).email,
        },
        newMembers:
          newMembersData.length > 0
            ? newMembersData
            : selectedMembers.map((id) => ({ userId: id })),
        newMemberIds: selectedMembers,
        timestamp: new Date().toISOString(),
      });
    }

    return response;
  } catch (error) {
    console.error("Error adding group participant:", error);
    return null;
  }
};
