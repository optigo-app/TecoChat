import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import { emitMemberPromoted, emitMemberDemoted } from "../../socket";
import { getGroupMemberIds } from "../../utils/groupSocketHelpers";
import type { AuthData } from "../../contexts/LoginData";

export interface AssignRoleParams {
  conversationId: number | string;
  memberId: number | string;
  currentIsAdmin?: number;
  targetMemberData?: { userId?: number | string; name?: string } | null;
}

export const assignRoleApi = async (
  auth: AuthData,
  { conversationId, memberId, currentIsAdmin = 0, targetMemberData = null }: AssignRoleParams
): Promise<any> => {
  try {
    const payload = {
      UserId: Number(auth?.id ?? auth?.userId),
      ConversationId: Number(conversationId),
      MemberId: Number(memberId),
    };

    const body = buildCommonBody("AssignRole", auth, payload, "Group ( AssignRole )");
    const response = await CommonAPI(body);

    if (response?.Status === "200") {
      const rd =
        response?.Data?.rd?.[0] ||
        (Array.isArray(response?.rd) ? response.rd[0] : response?.Data?.rd || response?.rd);

      if (rd?.stat === 0) {
        return response;
      }

      const allMemberIds = await getGroupMemberIds(conversationId, auth);
      const isPromotion = currentIsAdmin === 0;

      const enrichedRd = {
        ...rd,
        ConversationId: Number(conversationId),
        SystemMsg: 1,
      };

      const eventData = {
        ufcc: auth?.ufcc,
        eventType: isPromotion ? "member_promoted" : "member_demoted",
        conversationId: Number(conversationId),
        ReceiverId: allMemberIds,
        conversationData: enrichedRd,
        changedBy: {
          userId: auth?.id || auth?.userId,
          name: auth?.username || (auth as { name?: string }).name,
          email: (auth as { email?: string }).email,
        },
        targetMember: targetMemberData || { userId: memberId, name: "Member" },
        targetMemberId: Number(memberId),
        newRole: isPromotion ? "admin" : "member",
        isGroupAdmin: isPromotion ? 1 : 0,
        timestamp: new Date().toISOString(),
      };

      if (isPromotion) {
        emitMemberPromoted(eventData);
      } else {
        emitMemberDemoted(eventData);
      }
    }

    return response;
  } catch (error) {
    console.error("Error in assignRoleApi:", error);
    return null;
  }
};
