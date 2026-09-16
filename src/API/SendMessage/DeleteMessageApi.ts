import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

/**
 * Delete a message via the API.
 * Mirrors the old React app's DeleteMessageApi.js.
 *
 * mode: 1 = Delete for Me, 2 = Delete for Everyone
 * Endpoint: DeleteMessage
 */
export const deleteMessageApi = async (
  auth: AuthLike | AuthData | null,
  messageId: string | number,
  mode: number = 1,
  conversationId?: string | number | null
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for deleteMessageApi");
    }

    const payload = {
      UserId: (auth as AuthLike).id ?? (auth as AuthLike).userId ?? 0,
      MessageId: messageId,
      DeleteMode: mode,
      ConversationId: conversationId ?? "",
    };

    const body = buildCommonBody("DeleteMessage", auth, payload, "Delete Message");
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("deleteMessageApi Error:", error);
    return null;
  }
};
