import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

export const addReactionApi = async (
  auth: AuthData | null,
  {
    messageId,
    emoji,
    fLabel = "Reaction ( Add Reaction )",
  }: {
    messageId: string | number;
    emoji: string;
    fLabel?: string;
  }
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for addReactionApi");
    }

    const payload = {
      MessageId: messageId,
      UserId: auth?.id ?? 0,
      Emoji: emoji,
    };

    const body = buildCommonBody("AddReaction", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("addReactionApi Error:", error);
    return null;
  }
};
