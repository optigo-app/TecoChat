import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

export interface ClearChatParams {
  conversationId: number | string;
  userId?: string | number;
  fLabel?: string;
}

export const clearChatApi = async (
  auth: AuthData,
  { conversationId, fLabel = "Clear Chat" }: ClearChatParams
): Promise<any> => {
  try {
    if (!auth) {
      throw new Error("auth is required for clearChatApi");
    }

    const payload = {
      UserId: auth?.id ?? 0,
      ConversationId: conversationId,
    };

    const body = buildCommonBody("ClearChat", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("clearChatApi Error:", error);
    return null;
  }
};
