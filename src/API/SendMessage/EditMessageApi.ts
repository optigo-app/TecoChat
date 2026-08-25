import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

interface EditMessageParams {
  messageId: string | number;
  newMessage: string;
  mentionUsers?: Array<{
    MentionedUserId: string | number;
    MentionText: string;
    MentionType: number;
  }> | null;
}

/**
 * Edit an existing message.
 * Mirrors the old React app's EditMessageApi.js, extended to support
 * updating mentions in the native Next.js version.
 *
 * Endpoint: UpdateMessage
 */
export const editMessageApi = async (
  auth: AuthLike | AuthData | null,
  { messageId, newMessage, mentionUsers }: EditMessageParams
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for editMessageApi");
    }

    const payload: Record<string, unknown> = {
      MessageId: messageId,
      Message: newMessage,
      UserId: (auth as AuthLike).id ?? (auth as AuthLike).userId ?? 0,
    };

    // Include mention data if provided so the backend can update mentions
    if (mentionUsers && mentionUsers.length > 0) {
      payload.MentionUsers = JSON.stringify(mentionUsers);
    }

    const body = buildCommonBody(
      "UpdateMessage",
      auth,
      payload,
      "Edit Message ( Update Message Content )"
    );
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("editMessageApi Error:", error);
    return null;
  }
};
