import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

/**
 * Star / unstar a message.
 *
 * Backend mode: MakeStartMessage
 * Payload:
 *   - CommonUseJson: JSON-stringified array of message IDs, e.g. "[6431]"
 *   - UserId:        current user id
 *   - IsStar:        1 = star, 0 = unstar
 *
 * Response: response.Data.rd[0] = { stat, stat_msg, ... }
 */
export const starMessageApi = async (
  auth: AuthLike | AuthData | null,
  {
    messageId,
    isStar,
  }: {
    messageId: string | number;
    isStar: 0 | 1;
  }
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for starMessageApi");
    }

    const payload = {
      CommonUseJson: JSON.stringify([messageId]),
      UserId: (auth as AuthLike).id ?? (auth as AuthLike).userId ?? 0,
      IsStar: isStar,
    };

    const body = buildCommonBody(
      "MakeStartMessage",
      auth,
      payload,
      "Start Message ( MakeStartMessage )"
    );
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("starMessageApi Error:", error);
    return null;
  }
};
