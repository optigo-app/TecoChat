import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

/**
 * Forward a message to multiple conversations.
 * Mirrors the old React app's forwardMessageApi.js.
 *
 * Endpoint: ForwardMessage
 */
export const forwardMessageApi = async (
  auth: AuthLike | AuthData | null,
  params: Record<string, unknown>,
  fLabel = "Forward ( Forward Message To Multiple )"
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for forwardMessageApi");
    }

    const payload = {
      SenderId: (auth as AuthLike).id ?? 0,
      ...params,
    };

    const body = buildCommonBody("ForwardMessage", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("forwardMessageApi Error:", error);
    return null;
  }
};
