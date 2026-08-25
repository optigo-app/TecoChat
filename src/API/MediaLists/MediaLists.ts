import { CommonAPI } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

interface AuthLike {
  userId?: string;
}

interface MediaListsResult {
  data: unknown[];
  total: number;
  currentPage: number;
  hasMore: boolean;
}

/**
 * Fetch media/file lists for a conversation (paginated).
 * Mirrors the old React app's MediaLists.js.
 *
 * Endpoint: FilesList
 */
export const fetchMediaLists = async (
  page = 1,
  pageSize = 6,
  conversationId: string | number,
  auth: AuthLike | AuthData | null,
  userId?: string | number
): Promise<MediaListsResult> => {
  try {
    const conObj = {
      id: "",
      mode: "FilesList",
      appuserid: (auth as AuthLike)?.userId || "",
    };
    const pObj: Record<string, unknown> = { ConversationId: conversationId };

    // Only include UserId if it's provided and non-zero
    if (userId) {
      pObj.UserId = userId;
    }

    const body = {
      con: JSON.stringify(conObj),
      p: JSON.stringify(pObj),
      f: "Chat ( File list )",
    };

    const response = await CommonAPI(body);
    if (response?.Data) {
      return {
        data: response?.Data?.rd || [],
        total: response?.Data?.total || response?.Data?.rd?.length || 0,
        currentPage: page,
        hasMore: response?.Data?.rd?.length === pageSize,
      };
    } else {
      return {
        data: [],
        total: 0,
        currentPage: page,
        hasMore: false,
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      data: [],
      total: 0,
      currentPage: page,
      hasMore: false,
    };
  }
};
