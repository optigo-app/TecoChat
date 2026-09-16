import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";
import type { SendMessageResponse } from "../../types/message";

interface AuthLike {
  id?: string;
  userId?: string;
}

interface SendMessageParams {
  page?: number;
  pageSize?: number;
  senderId?: string | number;
  receiverId?: string | number | string[];
  conversationId?: string | number | null;
  message?: string;
  messageType?: number; // 1=text, 2=image, 3=video, 4=document
  attachments?: unknown[] | null;
  mentionUsers?: Array<{ MentionedUserId: string | number; MentionText: string; MentionType: number }> | null;
  fLabel?: string;
}

/**
 * Send a message via the API.
 * Mirrors the old React app's sendMessageApi.
 *
 * Endpoint: SendMessage
 * Response: response.Data.rd[0] = { stat, stat_msg, MessageId, ConversationId, IsNewConversation }
 */
export const sendMessageApi = async (
  auth: AuthLike | AuthData | null,
  {
    page = 1,
    pageSize = 50,
    senderId,
    receiverId,
    conversationId = null,
    message = "",
    messageType = 1,
    attachments = null,
    mentionUsers = null,
    fLabel = "Message ( Send Message )",
  }: SendMessageParams
): Promise<{ Data?: { rd?: SendMessageResponse[] } }> => {
  const payload: Record<string, unknown> = {
    Page: page,
    PageSize: pageSize,
    SenderId: senderId ?? (auth as AuthLike)?.id ?? 0,
    ReceiverId: receiverId ?? null,
    ConversationId: conversationId ?? null,
    Message: message,
    MessageType: messageType,
  };

  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    payload.Attachments = JSON.stringify(attachments);
  }

  if (mentionUsers && Array.isArray(mentionUsers) && mentionUsers.length > 0) {
    payload.MentionUsers = JSON.stringify(mentionUsers);
  }

  const body = buildCommonBody("SendMessage", auth as AuthLike, payload, fLabel);
  const response = await CommonAPI(body);
  return response;
};

/** Send a text message (messageType = 1) */
export const sendTextMessage = async (
  auth: AuthLike | AuthData | null,
  {
    senderId,
    receiverId,
    conversationId = null,
    message,
    mentionUsers = null,
  }: {
    senderId?: string | number;
    receiverId?: string | number | string[];
    conversationId?: string | number | null;
    message: string;
    mentionUsers?: Array<{ MentionedUserId: string | number; MentionText: string; MentionType: number }> | null;
  }
) => {
  return sendMessageApi(auth, {
    senderId,
    receiverId,
    conversationId,
    message,
    messageType: 1,
    attachments: null,
    mentionUsers,
    fLabel: "Message ( Send Message )",
  });
};

interface MediaSendParams {
  senderId?: string | number;
  receiverId?: string | number | string[];
  conversationId?: string | number | null;
  caption?: string;
  attachments?: unknown[];
}

/** Send an image message (messageType = 2) */
export const sendImageMessage = async (
  auth: AuthLike | AuthData | null,
  { senderId, receiverId, conversationId = null, caption = "", attachments = [] }: MediaSendParams
) => {
  return sendMessageApi(auth, {
    senderId,
    receiverId,
    conversationId,
    message: caption,
    messageType: 2,
    attachments,
    fLabel: "Message ( Send Image )",
  });
};

/** Send a video message (messageType = 3) */
export const sendVideoMessage = async (
  auth: AuthLike | AuthData | null,
  { senderId, receiverId, conversationId = null, caption = "", attachments = [] }: MediaSendParams
) => {
  return sendMessageApi(auth, {
    senderId,
    receiverId,
    conversationId,
    message: caption,
    messageType: 3,
    attachments,
    fLabel: "Message ( Send Video )",
  });
};

/** Send a document message (messageType = 4) */
export const sendDocumentMessage = async (
  auth: AuthLike | AuthData | null,
  { senderId, receiverId, conversationId = null, caption = "", attachments = [] }: MediaSendParams
) => {
  return sendMessageApi(auth, {
    senderId,
    receiverId,
    conversationId,
    message: caption,
    messageType: 4,
    attachments,
    fLabel: "Message ( Send Document )",
  });
};
