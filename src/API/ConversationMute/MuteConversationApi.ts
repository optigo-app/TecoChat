import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

interface AuthLike {
  id?: string;
  userId?: string;
}

export type MuteDuration = "8h" | "1w" | "always";

/**
 * Compute the ISO expiry datetime for a mute duration.
 * The client computes this so the backend just stores it as-is.
 *
 * - "8h"     -> now + 8 hours
 * - "1w"     -> now + 168 hours (7 days)
 * - "always" -> null (never expires)
 */
export const computeMuteExpiry = (duration: MuteDuration): string | null => {
  if (duration === "always") return null;
  const hours = duration === "8h" ? 8 : 168;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
};

interface MuteConversationParams {
  conversationId: string | number;
  isMuted: 0 | 1;
  muteExpiresAt: string | null;
}

interface MuteConversationResponse {
  stat: number;
  stat_msg?: string;
  IsMuted?: number;
  MuteExpiresAt?: string | null;
}

export const muteConversationApi = async (
  auth: AuthLike | AuthData | null,
  { conversationId, isMuted, muteExpiresAt }: MuteConversationParams
): Promise<MuteConversationResponse | null> => {
  try {
    if (!auth) {
      throw new Error("auth is required for muteConversationApi");
    }

    const payload = {
      UserId: (auth as AuthLike).id ?? (auth as AuthLike).userId ?? 0,
      ConversationId: conversationId,
      IsMuted: isMuted,
      MuteExpiresAt: muteExpiresAt,
    };

    const body = buildCommonBody(
      "NotificationPermission",
      auth,
      payload,
      "Conversation ( NotificationPermission )"
    );
    const response = await CommonAPI(body);
    return (response?.Data?.rd?.[0] as MuteConversationResponse) ?? null;
  } catch (error) {
    console.error("muteConversationApi Error:", error);
    return null;
  }
};
