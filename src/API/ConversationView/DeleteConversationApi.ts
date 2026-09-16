import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

export interface DeleteConversationParams {
  conversationId: number | string;
  fLabel?: string;
}

export const deleteConversationApi = async (
  auth: AuthData,
  { conversationId, fLabel = "Conversation ( ConversationDelete )" }: DeleteConversationParams
): Promise<any> => {
  try {
    if (!auth) {
      throw new Error("auth is required for deleteConversationApi");
    }

    const payload = {
      UserId: auth?.id ?? auth?.userId ?? 0,
      ConversationId: conversationId,
    };

    const body = buildCommonBody("ConversationDelete", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("deleteConversationApi Error:", error);
    return null;
  }
};
