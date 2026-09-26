// ─── Message helpers ────────────────────────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/messageHelpers.js
// Stable ID resolution, time helpers, status resolution, message merging.

import { formatDateTime } from "../../../utils/dateUtils";
import type { ChatMessage } from "../../../types/message";
import { putMessages, getMessagesAround } from "../../../db/messageCache";
import type { AuthData } from "../../../contexts/LoginData";

/** Stable string ID for any message shape. Canonical order:
 *  server id → local id → optimistic correlation id. */
export const getMessageId = (msg: ChatMessage | null | undefined): string => {
  if (!msg) return "";
  const primary = msg.MessageId ?? msg.Id ?? msg.ClientMessageId;
  if (primary != null && String(primary)) return String(primary);
  // Sanitized — this value lands in data-message-id / CSS selectors, so it
  // must never contain quotes or whitespace.
  const safeText = String(msg.Message ?? "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 24);
  return `temp_${msg.Direction}_${msg.DateTime}_${safeText}`;
};

/** Every identity a message can carry. The same logical message arrives in
 *  different shapes across optimistic / socket / REST / IDB paths — these
 *  are the keys under which any of those shapes may be found. */
export const getMessageAliasIds = (msg: ChatMessage | null | undefined): string[] => {
  if (!msg) return [];
  const out: string[] = [];
  for (const v of [msg.MessageId, msg.Id, msg.ClientMessageId]) {
    const s = v == null ? "" : String(v);
    if (s && !out.includes(s)) out.push(s);
  }
  const k = getMessageId(msg);
  if (k && !out.includes(k)) out.push(k);
  return out;
};

/** True when any alias of `msg` equals `id`. */
export const matchesMessageId = (
  msg: ChatMessage | null | undefined,
  id: string | number | null | undefined
): boolean => {
  if (!msg || id == null) return false;
  const s = String(id);
  if (!s) return false;
  return (
    String(msg.MessageId ?? "") === s ||
    String(msg.Id ?? "") === s ||
    String(msg.ClientMessageId ?? "") === s
  );
};

const OPTIMISTIC_STATUSES: ReadonlySet<unknown> = new Set(["pending", "failed", 4, "4"]);
export const isOptimisticStatus = (status: unknown): boolean =>
  OPTIMISTIC_STATUSES.has(status);

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

/** True when `a` and `b` are the same outgoing message in two shapes — a
 *  pending/failed optimistic row and its server-confirmed twin. Needed
 *  because optimistic rows carry temp ids that never match the server id,
 *  and `ClientMessageId` is not always echoed back. */
export const isOptimisticPair = (a: ChatMessage, b: ChatMessage): boolean => {
  if (isOptimisticStatus(a.Status) === isOptimisticStatus(b.Status)) return false;
  const opt = isOptimisticStatus(a.Status) ? a : b;
  const srv = opt === a ? b : a;
  // The optimistic side must be outgoing; the confirmed side may carry a
  // partial shape (API-response UPSERTs can omit Direction/ConversationId)
  // so only compare when the field is actually present.
  if (Number(opt.Direction) !== 1) return false;
  if (srv.Direction != null && Number(srv.Direction) !== 1) return false;
  if (
    srv.ConversationId != null &&
    opt.ConversationId != null &&
    String(opt.ConversationId) !== String(srv.ConversationId)
  )
    return false;
  const aType = String(a.MessageType ?? "text");
  const bType = String(b.MessageType ?? "text");
  if (aType !== bType) return false;
  const ta = tsOf(a);
  const tb = tsOf(b);
  if (ta && tb && Math.abs(ta - tb) > 120000) return false;
  // Reply context pins the pair — different reply targets = different messages
  const aCtx = String(
    a.ContextId ?? (a as { ReplyTo?: string | number }).ReplyTo ?? ""
  );
  const bCtx = String(
    b.ContextId ?? (b as { ReplyTo?: string | number }).ReplyTo ?? ""
  );
  if (aCtx && bCtx && aCtx !== bCtx) return false;
  const aMsg = String(a.Message ?? "");
  const bMsg = String(b.Message ?? "");
  if (aMsg || bMsg) return aMsg === bMsg;
  // Empty-body media: compare attachment fingerprints (filename/size)
  const ai = Array.isArray(a.mediaItems) ? a.mediaItems : [];
  const bi = Array.isArray(b.mediaItems) ? b.mediaItems : [];
  if (ai.length && bi.length) {
    if (ai.length !== bi.length) return false;
    return ai.every((x, i) => {
      const y = bi[i] as
        | { filename?: string; size?: number; mimeType?: string }
        | undefined;
      return (
        (!!x?.filename && x.filename === y?.filename) ||
        (!!x?.size && x.size === y?.size) ||
        (!!x?.mimeType && x.mimeType === y?.mimeType && ai.length === 1)
      );
    });
  }
  return true;
};

/** Collapse rows that share ANY identity alias into one — later entries win
 *  field conflicts. Used wherever rows from different sources are combined. */
export const dedupeByAlias = (list: ChatMessage[]): ChatMessage[] => {
  const byAlias = new Map<string, ChatMessage>();
  const out: ChatMessage[] = [];
  for (const m of list) {
    const aliases = getMessageAliasIds(m);
    let existing: ChatMessage | undefined;
    for (const a of aliases) {
      const e = byAlias.get(a);
      if (e) {
        existing = e;
        break;
      }
    }
    if (!existing) {
      out.push(m);
      for (const a of aliases) byAlias.set(a, m);
      continue;
    }
    const merged = { ...existing, ...m } as ChatMessage;
    const i = out.indexOf(existing);
    if (i >= 0) out[i] = merged;
    for (const a of getMessageAliasIds(merged)) byAlias.set(a, merged);
  }
  return out;
};

/**
 * Merge server messages with any optimistic/socket messages already in state.
 * Deduplicates by every identity alias, and drops pending/failed optimistic
 * rows whose server twin is already present in the page.
 */
export const mergeMessages = (
  serverMessages: ChatMessage[],
  prevData: ChatMessage[],
  selectedId: string | number | null | undefined
): ChatMessage[] => {
  if (!selectedId) {
    return dedupeByAlias([...serverMessages]).sort((a, b) => tsOf(a) - tsOf(b));
  }

  const serverRows = dedupeByAlias([...serverMessages]);
  const recentSocket = prevData.filter(
    (m) => Number(m.ConversationId) === Number(selectedId)
  );

  const map = new Map<string, ChatMessage>();
  for (const sm of serverRows) {
    for (const a of getMessageAliasIds(sm)) map.set(a, sm);
  }

  // A server row can absorb only ONE optimistic twin — a doc batch of N
  // pending rows must not all be folded into a single confirmed row.
  const consumed = new Set<ChatMessage>();
  for (const msg of recentSocket) {
    const aliases = getMessageAliasIds(msg);
    if (!aliases.length) continue;
    if (aliases.some((a) => map.has(a))) continue;
    // Pending/failed optimistic twin of a row already in this page — drop it
    // or the user sees the same message twice (pending bubble + real bubble).
    if (
      isOptimisticStatus(msg.Status) &&
      serverRows.some(
        (sm) =>
          !consumed.has(sm) && isOptimisticPair(msg, sm) && consumed.add(sm)
      )
    )
      continue;
    map.set(aliases[0], msg);
  }

  return [...new Set(map.values())].sort((a, b) => tsOf(a) - tsOf(b));
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
