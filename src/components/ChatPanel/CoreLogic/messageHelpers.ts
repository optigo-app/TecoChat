// ─── Message helpers ────────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/messageHelpers.js
// Stable ID resolution, time helpers, status resolution, message merging.

import { formatDateTime } from "../../../utils/dateUtils";
import type { ChatMessage } from "../../../types/message";
import { putMessages, getMessagesAround } from "../../../db/messageCache";
import type { AuthData } from "../../../contexts/LoginData";

/** Stable string ID for any message shape. */
export const getMessageId = (msg: ChatMessage | null | undefined): string => {
  if (!msg) return "";
  const primary = msg.MessageId ?? msg.Id;
  if (primary != null && String(primary)) return String(primary);
  return `temp_${msg.Direction}_${msg.Message}_${msg.DateTime}`;
};

/** Resolve a numeric status from any raw status value. */
export const resolveStatus = (raw: unknown): number => {
  if (typeof raw === "string") {
    const l = raw.toLowerCase();
    if (l === "read") return 3;
    if (l === "delivered") return 2;
    if (l === "sent") return 1;
    if (l === "failed") return 4;
  }
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isNaN(n) ? 0 : n;
};

/** Current local time components (local-as-UTC pattern). */
export const getLocalTime = (): {
  time: string;
  date: string;
  dateTime: string;
} => {
  const now = new Date();
  const localISO = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString();
  return {
    time: formatDateTime(localISO, "time"),
    date: localISO.split("T")[0],
    dateTime: localISO,
  };
};

interface AuthLike {
  id?: string;
  userId?: string;
}

// Cache DateTime parsing per message object — sorts and echo-match loops
// would otherwise call `new Date()` O(n log n) times per merge.
const tsCache = new WeakMap<ChatMessage, number>();
const tsOf = (m: ChatMessage): number => {
  let t = tsCache.get(m);
  if (t === undefined) {
    t = new Date(m.DateTime || 0).getTime();
    tsCache.set(m, t);
  }
  return t;
};

/**
 * Merge server messages with any optimistic/socket messages already in state.
 * Deduplicates by ID, preserving socket messages that aren't yet on the server.
 */
export const mergeMessages = (
  serverMessages: ChatMessage[],
  prevData: ChatMessage[],
  selectedId: string | number | null | undefined
): ChatMessage[] => {
  if (!selectedId) return [...serverMessages];

  const recentSocket = prevData.filter(
    (m) => Number(m.ConversationId) === Number(selectedId)
  );
  const optimistic = recentSocket.filter(
    (m) => m.Direction === 1 && m.Status === "pending"
  );

  const map = new Map<string, ChatMessage>();

  for (const sm of serverMessages) {
    const id = getMessageId(sm);
    if (id && !id.startsWith("temp_")) map.set(id, sm);
  }

  for (const msg of recentSocket) {
    const id = getMessageId(msg);
    if (!id || map.has(id)) continue;
    if (id.startsWith("temp_")) {
      const ts = tsOf(msg);
      const matched = serverMessages.some(
        (sm) =>
          sm.Direction === msg.Direction &&
          sm.Message === msg.Message &&
          Math.abs(tsOf(sm) - ts) < 15000
      );
      if (matched) continue;
    }
    map.set(id, msg);
  }

  for (const om of optimistic) {
    const id = getMessageId(om);
    if (!id || map.has(id)) continue;
    const ts = tsOf(om);
    const matched = serverMessages.some(
      (sm) =>
        sm.Direction === om.Direction &&
        sm.Message === om.Message &&
        Math.abs(tsOf(sm) - ts) < 15000
    );
    if (!matched) map.set(id, om);
  }

  return Array.from(map.values()).sort((a, b) => tsOf(a) - tsOf(b));
};

/** Group messages by date key for UI date separators. */
export const groupMessagesByDateHelper = (
  messages: ChatMessage[] | { data: ChatMessage[] }
): Record<string, ChatMessage[]> => {
  const list = Array.isArray(messages)
    ? messages
    : messages?.data ?? [];

  const grouped: Record<string, ChatMessage[]> = {};

  list.forEach((msg) => {
    if (!msg) return;
    let date: string;

    if (msg.Date) {
      try {
        const parsedDate = new Date(msg.Date);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString().split("T")[0];
        } else {
          date = msg.Date;
        }
      } catch {
        date = msg.Date;
      }
    } else if (msg.DateTime) {
      try {
        date = new Date(msg.DateTime).toISOString().split("T")[0];
      } catch {
        date = new Date().toISOString().split("T")[0];
      }
    } else {
      date = new Date().toISOString().split("T")[0];
    }

    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(msg);
  });

  return grouped;
};

/** Save messages to IndexedDB cache (now async). */
export const saveConversationToCache = (
  conversationId: string | number,
  messages: ChatMessage[],
  auth: AuthData | null,
  limit = 2000
): Promise<void> => {
  if (!conversationId || !Array.isArray(messages) || messages.length === 0) {
    return Promise.resolve();
  }
  const truncated = messages.slice(-limit);
  return putMessages(auth, conversationId, truncated);
};

/** Get the latest cached messages for a conversation from IndexedDB. */
export const getConversationFromCache = async (
  conversationId: string | number,
  auth: AuthData | null,
  limit = 2000
): Promise<ChatMessage[]> => {
  if (!conversationId) return [];
  return getMessagesAround(auth, conversationId, limit);
};

/** Normalize a single socket message and determine direction. */
export const normalizeSocketMessage = (
  rawData: Record<string, unknown>,
  auth: AuthLike | null,
  normalizeFn: (arr: unknown[], auth: AuthLike | null) => ChatMessage[]
): ChatMessage | null => {
  if (!rawData || typeof rawData !== "object") return null;
  const [normalized] = normalizeFn([rawData], auth) || [];
  if (!normalized) return null;

  // System messages (admin changes, group events, etc.) should always be
  // treated as incoming (Direction: 0) even if the current user triggered
  // the action, so they render as system notifications rather than
  // outgoing messages.
  const isSystemMessage =
    Number(rawData.SystemMsg ?? rawData.system_msg ?? 0) !== 0;
  const rawSenderId = Number(rawData.SenderId ?? rawData.Sender);
  const myId = Number(auth?.id ?? auth?.userId);
  const isMyMessage =
    !isSystemMessage && !!(rawSenderId && myId && rawSenderId === myId);
  const direction: 0 | 1 = isMyMessage
    ? 1
    : Number(normalized.Direction) === 2
    ? 0
    : ((normalized.Direction ?? 0) as 0 | 1);

  return { ...normalized, Direction: direction };
};
