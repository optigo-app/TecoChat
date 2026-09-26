// ─── Conversation message state reducer ─────────────────────────────────────
// Ported from OldChatReactCode/.../CoreLogic/conversationReducer.js
// Uses a single reducer for all message-list mutations (load, append,
// prepend, upsert, status, reaction, edit, delete, pagination flags).

import type { ChatMessage } from "../../../types/message";
import {
  getMessageAliasIds,
  matchesMessageId,
  isOptimisticStatus,
  isOptimisticPair,
} from "./messageHelpers";
import { parseReactions } from "../../../utils/EmojiUtils";

// Cache DateTime parsing per message object for sorts — Date construction is
// one of the hotter costs in PREPEND/APPEND on large lists.
const tsCache = new WeakMap<ChatMessage, number>();
const tsOf = (m: ChatMessage): number => {
  let t = tsCache.get(m);
  if (t === undefined) {
    t = new Date(m.DateTime || 0).getTime();
    tsCache.set(m, t);
  }
  return t;
};

// ─── Action types ────────────────────────────────────────────────────────────
export const MSG = {
  LOAD: "LOAD",
  APPEND: "APPEND",
  PREPEND: "PREPEND",
  UPSERT: "UPSERT",
  BUFFER_NEW: "BUFFER_NEW",
  FLUSH_NEW: "FLUSH_NEW",
  CLEAR_BUFFER: "CLEAR_BUFFER",
  UPDATE_STATUS: "UPDATE_STATUS",
  UPDATE_REACTION: "UPDATE_REACTION",
  EDIT: "EDIT",
  DELETE_ME: "DELETE_ME",
  DELETE_ALL: "DELETE_ALL",
  STAR: "STAR",
  CLEAR: "CLEAR",
  SET_LOADING: "SET_LOADING",
  SET_LOADING_OLDER: "SET_LOADING_OLDER",
  SET_LOADING_NEWER: "SET_LOADING_NEWER",
  SET_HAS_MORE: "SET_HAS_MORE",
  SET_HAS_MORE_BEFORE: "SET_HAS_MORE_BEFORE",
  SET_HAS_MORE_AFTER: "SET_HAS_MORE_AFTER",
  SET_PAGE: "SET_PAGE",
  SET_PAGE_SIZE: "SET_PAGE_SIZE",
  SET_CURSORS: "SET_CURSORS",
  SET_OLDER_ERROR: "SET_OLDER_ERROR",
  SET_NEWER_ERROR: "SET_NEWER_ERROR",
  SET_UNREAD_ANCHOR: "SET_UNREAD_ANCHOR",
  SET_TEMP_CONV: "SET_TEMP_CONV",
  SET_MESS_ID: "SET_MESS_ID",
  SET_STORE_MESS: "SET_STORE_MESS",
} as const;

export type MsgAction =
  | { type: "LOAD"; data: ChatMessage[]; total: number }
  | { type: "APPEND"; data: ChatMessage[]; total: number }
  | { type: "PREPEND"; data: ChatMessage[]; total: number }
  | { type: "UPSERT"; id: string; msg: Partial<ChatMessage> }
  | { type: "BUFFER_NEW"; msg: ChatMessage }
  | { type: "FLUSH_NEW" }
  | { type: "CLEAR_BUFFER" }
  | {
      type: "UPDATE_STATUS";
      messageId?: string | number;
      conversationId?: string | number;
      status: number;
      extra?: Partial<ChatMessage>;
    }
  | {
      type: "UPDATE_REACTION";
      messageId: string | number;
      reactions: Array<{ Reaction?: string; UserId?: string | number }>;
      senderId?: string | number;
    }
  | {
      type: "EDIT";
      messageId: string | number;
      newMessage: string;
      time?: string;
      date?: string;
      MentionUsers?: string;
    }
  | { type: "DELETE_ME"; messageId: string | number }
  | {
      type: "DELETE_ALL";
      messageId: string | number;
      deletedInfo: Partial<ChatMessage> & { Message?: string; Message1?: string; DeletedAt?: string };
    }
  | { type: "STAR"; messageId: string | number; isStar: 0 | 1 }
  | { type: "CLEAR" }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_LOADING_OLDER"; value: boolean }
  | { type: "SET_LOADING_NEWER"; value: boolean }
  | { type: "SET_HAS_MORE"; value: boolean }
  | { type: "SET_HAS_MORE_BEFORE"; value: boolean }
  | { type: "SET_HAS_MORE_AFTER"; value: boolean }
  | { type: "SET_PAGE"; value: number }
  | { type: "SET_PAGE_SIZE"; value: number }
  | { type: "SET_CURSORS"; beforeCursor: number | null; afterCursor: number | null }
  | { type: "SET_OLDER_ERROR"; value: boolean }
  | { type: "SET_NEWER_ERROR"; value: boolean }
  | { type: "SET_UNREAD_ANCHOR"; messageId: string | number | null; count: number }
  | { type: "SET_TEMP_CONV"; value: string | number | null }
  | { type: "SET_MESS_ID"; value: string }
  | { type: "SET_STORE_MESS"; value: { messageId: string } };

export interface MsgState {
  data: ChatMessage[];
  total: number;
  loading: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  hasMore: boolean;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  beforeCursor: number | null;
  afterCursor: number | null;
  olderError: boolean;
  newerError: boolean;
  unreadAnchorMessageId: string | number | null;
  unreadCount: number;
  currentPage: number;
  currentPageSize: number;
  tempConversationId: string | number | null;
  messId: string;
  storeMessData: { messageId: string };
  /** Buffered new socket messages when user is scrolled up (WhatsApp-style) */
  pendingNewMessages: ChatMessage[];
}

export const msgInitialState: MsgState = {
  data: [],
  total: 0,
  loading: false,
  loadingOlder: false,
  loadingNewer: false,
  hasMore: true,
  hasMoreBefore: false,
  hasMoreAfter: false,
  beforeCursor: null,
  afterCursor: null,
  olderError: false,
  newerError: false,
  unreadAnchorMessageId: null,
  unreadCount: 0,
  currentPage: 1,
  currentPageSize: 50,
  tempConversationId: null,
  messId: "",
  storeMessData: { messageId: "" },
  pendingNewMessages: [],
};

export function messagesReducer(state: MsgState, action: MsgAction): MsgState {
  switch (action.type) {
    case MSG.LOAD:
      return { ...state, data: action.data, total: action.total };

    case MSG.APPEND: {
      // Dedup by every identity alias, and fold pending/failed optimistic
      // rows into their server twin — a reconnect-sync APPEND can carry the
      // confirmed copy of a message that's still pending in state.
      const byAlias = new Map<string, ChatMessage>();
      const order: ChatMessage[] = [];
      const claim = (m: ChatMessage) => {
        for (const a of getMessageAliasIds(m)) byAlias.set(a, m);
      };
      for (const m of state.data) {
        order.push(m);
        claim(m);
      }
      for (const m of action.data as ChatMessage[]) {
        const aliases = getMessageAliasIds(m);
        let hit: ChatMessage | undefined;
        for (const a of aliases) {
          const e = byAlias.get(a);
          if (e) {
            hit = e;
            break;
          }
        }
        if (hit) {
          const merged = { ...hit, ...m } as ChatMessage;
          const i = order.indexOf(hit);
          if (i >= 0) order[i] = merged;
          claim(merged);
          continue;
        }
        const optIdx = order.findIndex(
          (o) => isOptimisticStatus(o.Status) && isOptimisticPair(o, m)
        );
        if (optIdx >= 0) {
          const merged = { ...order[optIdx], ...m } as ChatMessage;
          order[optIdx] = merged;
          claim(merged);
          continue;
        }
        order.push(m);
        claim(m);
      }
      return {
        ...state,
        data: order.sort((a, b) => tsOf(a) - tsOf(b)),
        total: action.total,
      };
    }

    case MSG.PREPEND: {
      const byAlias = new Map<string, ChatMessage>();
      const order: ChatMessage[] = [];
      const claim = (m: ChatMessage) => {
        for (const a of getMessageAliasIds(m)) byAlias.set(a, m);
      };
      for (const m of action.data as ChatMessage[]) {
        order.push(m);
        claim(m);
      }
      for (const m of state.data) {
        const aliases = getMessageAliasIds(m);
        if (aliases.length && aliases.some((a) => byAlias.has(a))) continue;
        if (
          isOptimisticStatus(m.Status) &&
          order.some((o) => isOptimisticPair(m, o))
        )
          continue;
        order.push(m);
        claim(m);
      }
      const merged = order.sort((a, b) => tsOf(a) - tsOf(b));
      return { ...state, data: merged, total: action.total };
    }

    case MSG.UPSERT: {
      const incoming = action.msg;
      const id = action.id;
      const incomingId = String(incoming.MessageId ?? incoming.Id ?? "");
      const clientMessageId = String(
        (incoming as ChatMessage & { ClientMessageId?: string | number }).ClientMessageId ?? ""
      );
      const idx = state.data.findIndex(
        (m) =>
          matchesMessageId(m, id) ||
          matchesMessageId(m, incomingId) ||
          matchesMessageId(m, clientMessageId)
      );
      if (idx >= 0) {
        const existing = state.data[idx];
        const next = [...state.data];
        next[idx] = {
          ...existing,
          ...incoming,
          isUploading:
            "isUploading" in incoming ? incoming.isUploading : existing.isUploading,
          percent: "percent" in incoming ? incoming.percent : existing.percent,
        };
        return { ...state, data: next };
      }
      // A socket echo can arrive before the API response and have a different
      // direction or server ID. Reconcile it with the matching optimistic row.
      // Skip this matching when the incoming message is itself an optimistic
      // message (Status "pending" or 4) — otherwise new outgoing messages
      // with the same caption and conversation would overwrite each other.
      const incomingStatus = incoming.Status as unknown;
      const incomingIsOptimistic = isOptimisticStatus(incomingStatus);
      if (incomingIsOptimistic) {
        const newArr = [...state.data];
        const newMsg = incoming as ChatMessage;
        const newTime = new Date(newMsg.DateTime || 0).getTime();
        let lo = 0, hi = newArr.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          const midTime = new Date(newArr[mid].DateTime || 0).getTime();
          if (midTime < newTime) lo = mid + 1;
          else hi = mid;
        }
        newArr.splice(lo, 0, newMsg);
        return { ...state, data: newArr };
      }
      const optimisticCandidates = state.data
        .map((m, index) => ({ message: m, index }))
        .filter(({ message: m }) =>
          isOptimisticPair(m, incoming as ChatMessage)
        );
      const incomingTime = new Date(incoming.DateTime || 0).getTime();
      const optimisticIdx = optimisticCandidates
        .sort((a, b) => {
          const aTime = new Date(a.message.DateTime || 0).getTime();
          const bTime = new Date(b.message.DateTime || 0).getTime();
          return Math.abs(aTime - incomingTime) - Math.abs(bTime - incomingTime);
        })[0]?.index ?? -1;
      if (optimisticIdx >= 0) {
        const existing = state.data[optimisticIdx];
        const next = [...state.data];
        next[optimisticIdx] = { ...existing, ...incoming, Direction: 1 } as ChatMessage;
        return { ...state, data: next };
      }

      // New message: binary-insert in chronological order instead of full sort.
      // This keeps the list ordered for clock skew / delayed delivery without
      // the O(n log n) cost of sorting the entire array on every message.
      const newArr = [...state.data];
      const newMsg = incoming as ChatMessage;
      const newTime = new Date(newMsg.DateTime || 0).getTime();
      // Binary search for insertion point
      let lo = 0, hi = newArr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const midTime = new Date(newArr[mid].DateTime || 0).getTime();
        if (midTime < newTime) lo = mid + 1;
        else hi = mid;
      }
      newArr.splice(lo, 0, newMsg);
      return { ...state, data: newArr };
    }

    case MSG.UPDATE_STATUS: {
      const { messageId, conversationId, status, extra } = action;
      return {
        ...state,
        data: state.data.map((msg) => {
          if (msg.Direction !== 1) return msg;
          const idMatch =
            messageId &&
            (matchesMessageId(msg, messageId) ||
              (msg.Message === extra?.Message &&
                Math.abs(
                  new Date(msg.DateTime || 0).getTime() -
                    new Date(extra?.DateTime || 0).getTime()
                ) < 60000));
          const convMatch =
            !messageId &&
            conversationId &&
            Number(msg.ConversationId) === Number(conversationId);
          if (!idMatch && !convMatch) return msg;

          const current = parseInt(String(msg.Status), 10) || 0;
          if (current >= status) return msg;
          // Only spread extra fields that have defined values — don't
          // overwrite existing DateTime/SenderInfo with undefined (which
          // would break sorting and time display, making the message
          // appear invisible/misplaced after a read receipt).
          const safeExtra: Record<string, unknown> = {};
          if (extra) {
            for (const [k, v] of Object.entries(extra)) {
              if (v != null) safeExtra[k] = v;
            }
          }
          return { ...msg, Status: status as ChatMessage["Status"], ...safeExtra };
        }),
      };
    }

    case MSG.UPDATE_REACTION: {
      const { messageId, reactions, senderId } = action;
      return {
        ...state,
        data: state.data.map((msg) => {
          if (!matchesMessageId(msg, messageId)) return msg;

          let current = parseReactions(msg.ReactionEmojis);

          if (Array.isArray(reactions) && reactions.length > 0) {
            reactions.forEach((incoming) => {
              const sid = incoming.UserId || senderId;
              if (!sid) return;
              current = current.filter((r) => String(r.UserId) !== String(sid));
              if (incoming.Reaction && incoming.Reaction !== "") {
                current.push({ ...incoming, UserId: sid });
              }
            });
          } else if (senderId) {
            current = current.filter((r) => String(r.UserId) !== String(senderId));
          }

          return { ...msg, ReactionEmojis: JSON.stringify(current) };
        }),
      };
    }

    case MSG.EDIT: {
      const { messageId, newMessage, time, date, MentionUsers } = action;
      return {
        ...state,
        data: state.data.map((msg) => {
          if (!matchesMessageId(msg, messageId)) return msg;
          return {
            ...msg,
            Message: newMessage,
            IsEdited: 1,
            Direction: 1,
            Time: time,
            Date: date,
            ...(MentionUsers ? { MentionUsers, Mentions: MentionUsers } : {}),
          };
        }),
      };
    }

    case MSG.DELETE_ME:
      return {
        ...state,
        data: state.data.filter((m) => !matchesMessageId(m, action.messageId)),
      };

    case MSG.DELETE_ALL: {
      const { messageId, deletedInfo } = action;
      return {
        ...state,
        data: state.data.map((msg) => {
          if (!matchesMessageId(msg, messageId)) return msg;
          return {
            ...msg,
            Message: deletedInfo.Message || "This message was deleted.",
            Message1: deletedInfo.Message1 || "You deleted this message.",
            IsDeletedForEveryone: 1,
            DeletedAt: deletedInfo.DeletedAt || new Date().toISOString(),
            MessageType: "text",
          };
        }),
      };
    }

    case MSG.CLEAR:
      return { ...msgInitialState };

    case MSG.BUFFER_NEW: {
      // Don't buffer duplicates — compare every identity alias, not just the
      // canonical key, so an echo carrying a different id shape can't slip in.
      const aliases = getMessageAliasIds(action.msg);
      if (!aliases.length) return state;
      const collides = (m: ChatMessage) =>
        getMessageAliasIds(m).some((a) => aliases.includes(a));
      if (
        state.pendingNewMessages.some(collides) ||
        state.data.some(collides)
      ) {
        return state;
      }
      return {
        ...state,
        pendingNewMessages: [...state.pendingNewMessages, action.msg],
      };
    }

    case MSG.FLUSH_NEW: {
      if (state.pendingNewMessages.length === 0) return state;
      // Merge buffered messages into the visible list (sorted by date),
      // deduplicating across all identity aliases.
      const byAlias = new Map<string, ChatMessage>();
      const order: ChatMessage[] = [];
      for (const m of state.data) {
        order.push(m);
        for (const a of getMessageAliasIds(m)) byAlias.set(a, m);
      }
      for (const m of state.pendingNewMessages) {
        const aliases = getMessageAliasIds(m);
        if (aliases.length && aliases.some((a) => byAlias.has(a))) continue;
        order.push(m);
        for (const a of aliases) byAlias.set(a, m);
      }
      const merged = order.sort(
        (a, b) =>
          new Date(a.DateTime || 0).getTime() - new Date(b.DateTime || 0).getTime()
      );
      return { ...state, data: merged, pendingNewMessages: [] };
    }

    case MSG.CLEAR_BUFFER:
      return { ...state, pendingNewMessages: [] };

    case MSG.STAR: {
      const { messageId, isStar } = action;
      return {
        ...state,
        data: state.data.map((msg) => {
          if (!matchesMessageId(msg, messageId)) return msg;
          return { ...msg, IsStar: isStar };
        }),
      };
    }

    case MSG.SET_LOADING:
      return { ...state, loading: action.value };
    case MSG.SET_LOADING_OLDER:
      return { ...state, loadingOlder: action.value };
    case MSG.SET_LOADING_NEWER:
      return { ...state, loadingNewer: action.value };
    case MSG.SET_HAS_MORE:
      return { ...state, hasMore: action.value };
    case MSG.SET_HAS_MORE_BEFORE:
      return { ...state, hasMoreBefore: action.value };
    case MSG.SET_HAS_MORE_AFTER:
      return { ...state, hasMoreAfter: action.value };
    case MSG.SET_PAGE:
      return { ...state, currentPage: action.value };
    case MSG.SET_PAGE_SIZE:
      return { ...state, currentPageSize: action.value };
    case MSG.SET_CURSORS:
      return {
        ...state,
        beforeCursor: action.beforeCursor,
        afterCursor: action.afterCursor,
      };
    case MSG.SET_OLDER_ERROR:
      return { ...state, olderError: action.value };
    case MSG.SET_NEWER_ERROR:
      return { ...state, newerError: action.value };
    case MSG.SET_UNREAD_ANCHOR:
      return {
        ...state,
        unreadAnchorMessageId: action.messageId,
        unreadCount: action.count,
      };
    case MSG.SET_TEMP_CONV:
      return { ...state, tempConversationId: action.value };
    case MSG.SET_MESS_ID:
      return { ...state, messId: action.value };
    case MSG.SET_STORE_MESS:
      return { ...state, storeMessData: action.value };

    default:
      return state;
  }
}
