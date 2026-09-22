import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../contexts/LoginData";
import type { ChatMessage, ConversationViewResponse } from "../../types/message";
import { normalizeServerMessages, sortMessagesByDate } from "../../utils/messageUtils";

interface AuthLike {
  id?: string;
  userId?: string;
}

export const conversationView = async (
  conversationId: string | number,
  page = 1,
  pageSize = 10,
  auth: AuthLike | AuthData | null,
  signal?: AbortSignal | null,
  searchMsg = "",
  fLabel = "Chat ( View )"
): Promise<ConversationViewResponse> => {
  try {
    const payload = {
      Page: page,
      PageSize: pageSize,
      ConversationId: conversationId,
      UserId: (auth as AuthLike)?.id ?? "",
      SearchMsg: searchMsg || "",
    };

    const body = buildCommonBody("GetMessages", auth as AuthLike, payload, fLabel);
    const response = await CommonAPI(body, signal ? { signal } : undefined);

    const rd = response?.Data?.rd || [];
    const total = response?.Data?.total || rd.length || 0;

    // Normalize and sort messages (oldest first)
    const normalized = normalizeServerMessages(rd, auth as AuthLike, conversationId);
    const sorted = sortMessagesByDate(normalized) as ChatMessage[];

    return {
      data: sorted,
      total,
      currentPage: page,
      hasMore: rd.length === pageSize,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "AbortError") {
      throw error;
    }
    console.error("conversationView error:", error);
    return {
      data: [],
      total: 0,
      currentPage: page,
      hasMore: false,
    };
  }
};

// ─── Cursor-based message loading ───────────────────────────────────────────
// Direction: 0 = INITIAL (open conversation — latest page), 1 = AFTER (newer),
// 2 = BEFORE (older), 3 = BETWEEN (search jump — bi-directional around a cursor),
// 4 = DATE SEARCH (calendar jump — anchored on MsgDate, no cursor needed)
export type CursorDirection = 0 | 1 | 2 | 3 | 4;

export interface CursorResponse {
  data: ChatMessage[];
  total: number;
  beforeCursor: number | null;
  afterCursor: number | null;
  currentCursor: number | null;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

export const conversationViewCursor = async (
  conversationId: string | number,
  direction: CursorDirection,
  cursorMessageId: number,
  pageSize: number,
  auth: AuthLike | AuthData | null,
  signal?: AbortSignal | null,
  fLabel = "Message ( Get Message List )",
  isStarFilter: 0 | 1 = 0,
  searchDate?: string | null
): Promise<CursorResponse> => {
  try {
    const payload: Record<string, unknown> = {
      Direction: direction,
      PageSize: pageSize,
      ConversationId: conversationId,
      UserId: (auth as AuthLike)?.id ?? "",
      IsStar: isStarFilter,
    };

    // Direction 4 (date search) anchors on MsgDate — CursorMessageId is
    // not sent at all so the backend doesn't try to resolve a cursor.
    if (direction !== 4) {
      payload.CursorMessageId = cursorMessageId;
    }

    // Optional date search — when provided, the backend returns messages
    // around the given date.
    if (searchDate) {
      payload.MsgDate = searchDate;
    }

    const body = buildCommonBody("GetMessagesCursor", auth as AuthLike, payload, fLabel);
    const response = await CommonAPI(body, signal ? { signal } : undefined);

    const rd = response?.Data?.rd || [];
    const rd1 = response?.Data?.rd1?.[0] || {};
    const total = response?.Data?.total || rd.length || 0;

    const normalized = normalizeServerMessages(rd, auth as AuthLike, conversationId);
    const sorted = sortMessagesByDate(normalized) as ChatMessage[];

    return {
      data: sorted,
      total,
      beforeCursor: rd1.BeforeCursor ?? null,
      afterCursor: rd1.AfterCursor ?? null,
      currentCursor: rd1.CurrentCursor ?? null,
      hasMoreBefore: Boolean(rd1.HasMoreBefore),
      hasMoreAfter: Boolean(rd1.HasMoreAfter),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "AbortError") {
      throw error;
    }
    console.error("conversationViewCursor error:", error);
    throw error;
  }
};
