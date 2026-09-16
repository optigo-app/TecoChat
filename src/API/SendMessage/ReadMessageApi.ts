import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

/**
 * Mark a conversation's messages as read.
 * Mirrors the old React app's ReadMessageApi.js.
 *
 * Endpoint: ReadMessage
 */
export const readMessageApi = async (
  auth: AuthLike | AuthData | null,
  {
    ConversationId,
    fLabel = "Read Message",
    signal = null,
  }: {
    ConversationId: string | number;
    fLabel?: string;
    signal?: AbortSignal | null;
  }
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for readMessageApi");
    }

    const payload = {
      ConversationId: ConversationId,
      UserId: (auth as AuthLike).id ?? (auth as AuthLike).userId ?? 0,
    };

    const body = buildCommonBody("ReadMessage", auth, payload, fLabel);
    const response = await CommonAPI(body, { signal: signal ?? undefined });
    return response;
  } catch (error) {
    console.error("readMessageApi Error:", error);
    return null;
  }
};
