import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import { emitMemberRemoved } from "../../socket";
import { getGroupMemberIds } from "../../utils/groupSocketHelpers";
import type { AuthData } from "../../contexts/LoginData";

export interface RemoveMemberParams {
  conversationId: number | string;
  memberId: number | string;
  removedMemberData?: { userId?: number | string; name?: string } | null;
}

export const removeMemberApi = async (
  auth: AuthData,
  { conversationId, memberId, removedMemberData = null }: RemoveMemberParams
): Promise<any> => {
  try {
    const currentUserId = auth?.id || auth?.userId;
    const isSelfExit = Number(currentUserId) === Number(memberId);

    const payload = {
      UserId: Number(currentUserId),
      MemberId: Number(memberId),
      ConversationId: Number(conversationId),
    };

    const body = buildCommonBody("RemoveMembers", auth, payload, "Group ( RemoveMembers )");
    const response = await CommonAPI(body);

    if (response?.Status === "200") {
      const rd =
        response?.Data?.rd?.[0] ||
        (Array.isArray(response?.rd) ? response.rd[0] : response?.Data?.rd || response?.rd);

      if (rd?.stat === 0) {
        return response;
      }

      const allMemberIds = await getGroupMemberIds(conversationId, auth);
      const broadcastIds = Array.from(new Set([...allMemberIds, Number(memberId)]));

      const enrichedRd = {
        ...rd,
        ConversationId: Number(conversationId),
        SystemMsg: 1,
      };

      emitMemberRemoved({
        ufcc: auth?.ufcc,
        eventType: "member_removed",
        conversationId: Number(conversationId),
        ReceiverId: broadcastIds,
        conversationData: enrichedRd,
        removedBy: {
          userId: currentUserId,
          name: auth?.username || (auth as { name?: string }).name,
          email: (auth as { email?: string }).email,
        },
        removedMember: removedMemberData || {
          userId: memberId,
          name: isSelfExit ? auth?.username || (auth as { name?: string }).name || "Member" : "Member",
        },
        removedMemberId: Number(memberId),
        reason: isSelfExit ? "left" : "removed",
        removeInGroup: 1,
        timestamp: new Date().toISOString(),
      });
    }

    return response;
  } catch (error) {
    console.error("Error in removeMemberApi:", error);
    return null;
  }
};
