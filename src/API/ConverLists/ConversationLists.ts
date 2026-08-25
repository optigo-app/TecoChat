import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";
import type { FetchConversationResult } from "../../types/conversation";

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
