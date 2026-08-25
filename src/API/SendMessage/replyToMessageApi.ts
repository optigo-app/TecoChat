import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

/**
 * Reply to a specific message.
 * Mirrors the old React app's replyToMessageApi.js.
 *
 * Endpoint: ReplyToMessage
 */
export const replyToMessageApi = async (
  auth: AuthLike | AuthData | null,
  {
    conversationId,
    replyToMessageId,
    ReplyToAttachmentId,
    message,
    messageType = 1,
    fLabel = "Reply ( Reply to Message )",
  }: {
    conversationId: string | number;
    replyToMessageId: string | number;
    ReplyToAttachmentId?: string | number | null;
    message: string;
    messageType?: number;
    fLabel?: string;
  }
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for replyToMessageApi");
    }

    const payload = {
      SenderId: (auth as AuthLike).id ?? 0,
      ConversationId: conversationId,
      ReplyToMessageId: replyToMessageId,
      ReplyToAttachmentId: ReplyToAttachmentId || null,
      Message: message,
      MessageType: messageType,
    };

    const body = buildCommonBody("ReplyToMessage", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("replyToMessageApi Error:", error);
    return null;
  }
};
