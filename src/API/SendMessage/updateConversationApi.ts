import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

/**
 * Update conversation properties (pin, star, archive).
 * Mirrors the old React app's updateConversationApi.js.
 *
 * Endpoint: UpdateConversation
 */
export const updateConversationApi = async (
  auth: AuthLike | AuthData | null,
  {
    conversationId,
    isPin = 0,
    isStar = 0,
    isArchived = 0,
    fLabel = "Update ( Update Conversation )",
  }: {
    conversationId: string | number;
    isPin?: number;
    isStar?: number;
    isArchived?: number;
    fLabel?: string;
  }
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for updateConversationApi");
    }

    const payload = {
      CommonUseJson: JSON.stringify([conversationId]),
      UserId: (auth as AuthLike).id ?? 0,
      IsPin: isPin,
      IsStar: isStar,
      IsArchived: isArchived,
    };

    const body = buildCommonBody("UpdateConversation", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("updateConversationApi Error:", error);
    return null;
  }
};
