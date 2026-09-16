import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";
import type { FetchConversationResult, RawConversation } from "../../types/conversation";

interface AuthLike {
  id?: string;
  userId?: string;
}

export const fetchConversationLists = async (
  page = 1,
  pageSize = 50,
  auth: AuthLike | AuthData | null,
  search = "",
  signal: AbortSignal | null | undefined = null,
  fLabel = "Chat ( List Conversation )"
): Promise<FetchConversationResult> => {
  try {
    const payload = {
      Page: page ?? 1,
      PageSize: pageSize ?? 50,
      UserId: (auth as AuthLike)?.id ?? "",
      SearchTerm: search ?? "",
    };

    const body = buildCommonBody("GetConversationList", auth as AuthLike, payload, fLabel);
    const response = await CommonAPI(body, signal ? { signal } : undefined);

    if (response?.Data) {
      const rd = response.Data.rd || [];
      const rd1 = response.Data.rd1 || [];

      // Maintenance detection
      const isMaintenance =
        rd.length > 0 && rd[0]?.stat !== undefined && rd[0]?.stat_msg;
      if (isMaintenance) {
        return {
          data: { rd: [], rd1: [], total: 0 },
          total: 0,
          currentPage: page,
          hasMore: false,
          serviceDown: true,
          serviceMessage: rd[0].stat_msg || "Service is temporarily unavailable.",
          statCode: rd[0].stat_code || null,
        };
      }

      const rdLength = rd.length;
      const rd1Length = rd1.length;
      const totalItems = rdLength + rd1Length;

      return {
        data: {
          rd,
          rd1,
          total: response?.Data?.total || totalItems || 0,
        },
        total: response?.Data?.total || totalItems || 0,
        currentPage: page,
        hasMore: rdLength === pageSize,
        serviceDown: false,
      };
    }

    return {
      data: { rd: [], rd1: [], total: 0 },
      total: 0,
      currentPage: page,
      hasMore: false,
      serviceDown: false,
    };
  } catch (error) {
    // AbortError is thrown as a string "AbortError" by CommonAPI
    if (error instanceof Error && error.message === "AbortError") {
      throw error;
    }
    console.error("fetchConversationLists error:", error);
    return {
      data: { rd: [], rd1: [], total: 0 },
      total: 0,
      currentPage: page,
      hasMore: false,
      serviceDown: false,
    };
  }
};

// ─── PreLoadConversation ───────────────────────────────────────────────────
// Fetches conversations AND their latest messages in a single API call.
// Each rd item contains conversation metadata + a "message" field (JSON string
// of recent messages for that conversation).
export interface PreLoadResult {
  conversations: RawConversation[];
  messagesByConversation: Map<number, unknown[]>;
}

export const preLoadConversations = async (
  page = 1,
  pageSize = 50,
  auth: AuthLike | AuthData | null,
  signal?: AbortSignal | null
): Promise<PreLoadResult> => {
  try {
    const payload = {
      Page: page ?? 1,
      PageSize: pageSize ?? 50,
      UserId: (auth as AuthLike)?.id ?? "",
    };

    const body = buildCommonBody(
      "PreLoadConversation",
      auth as AuthLike,
      payload,
      "List ( Conversation List )"
    );
    const response = await CommonAPI(body, signal ? { signal } : undefined);

    const rd: RawConversation[] = response?.Data?.rd || [];
    const messagesByConversation = new Map<number, unknown[]>();

    for (const item of rd) {
      const convId = Number(item.ConversationId ?? item.Id ?? 0);
      if (!convId) continue;

      const rawMessage = (item as Record<string, unknown>).message;
      if (rawMessage == null) continue;

      let messages: unknown[] = [];
      try {
        messages =
          typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage;
      } catch {
        continue;
      }
      if (Array.isArray(messages) && messages.length > 0) {
        messagesByConversation.set(convId, messages);
      }
    }

    return { conversations: rd, messagesByConversation };
  } catch (error) {
    if (error instanceof Error && error.message === "AbortError") {
      throw error;
    }
    console.error("preLoadConversations error:", error);
    return { conversations: [], messagesByConversation: new Map() };
  }
};
