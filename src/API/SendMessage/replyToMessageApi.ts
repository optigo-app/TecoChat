import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

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
    receiverId,
    mentionUsers = null,
    attachments = null,
    fLabel = "Reply ( Reply to Message )",
  }: {
    conversationId: string | number;
    replyToMessageId: string | number;
    ReplyToAttachmentId?: string | number | null;
    message: string;
    messageType?: number;
    receiverId?: string | number | string[];
    mentionUsers?: Array<{ MentionedUserId: string | number; MentionText: string; MentionType: number }> | null;
    attachments?: unknown[] | null;
    fLabel?: string;
  }
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for replyToMessageApi");
    }

    const payload: Record<string, unknown> = {
      SenderId: (auth as AuthLike).id ?? 0,
      ReceiverId: receiverId ?? null,
      ConversationId: conversationId,
      ReplyToMessageId: replyToMessageId,
      ReplyToAttachmentId: ReplyToAttachmentId || null,
      Message: message,
      MessageType: messageType,
    };

    // Same MentionUsers contract as SendMessage — replies can carry mentions.
    if (mentionUsers && Array.isArray(mentionUsers) && mentionUsers.length > 0) {
      payload.MentionUsers = JSON.stringify(mentionUsers);
    }

    // Media replies (image/video/document) — same Attachments contract as
    // SendMessage so the reply bubble carries the uploaded file(s).
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      payload.Attachments = JSON.stringify(attachments);
    }

    const body = buildCommonBody("ReplyToMessage", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("replyToMessageApi Error:", error);
    return null;
  }
};
