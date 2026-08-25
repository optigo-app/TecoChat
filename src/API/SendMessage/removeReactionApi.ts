import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

export const removeReactionApi = async (
  auth: AuthData | null,
  {
    messageId,
    fLabel = "Reaction ( Remove Reaction )",
  }: {
    messageId: string | number;
    fLabel?: string;
  }
) => {
  try {
    if (!auth) {
      throw new Error("auth is required for removeReactionApi");
    }

    const payload = {
      MessageId: messageId,
      UserId: auth?.id ?? 0,
    };

    const body = buildCommonBody("RemoveReaction", auth, payload, fLabel);
    const response = await CommonAPI(body);
    return response;
  } catch (error) {
    console.error("removeReactionApi Error:", error);
    return null;
  }
};
