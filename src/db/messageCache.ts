"use client";

import { getDb } from "./tecoDb";
import type { ChatMessage } from "../types/message";
import type { AuthData } from "../context/LoginData";

const MESSAGES_PER_CONVERSATION = 2000;

const TRANSIENT_FIELDS: Array<keyof ChatMessage> = [
  "isUploading",
  "percent",
  "previewUrl",
];

function stripNonCloneable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "function" || t === "symbol") return undefined;
  if (t !== "object") return value;
  if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) return undefined;
  const obj = value as Record<string, unknown>;
  if (obj.$$typeof != null) return undefined;
  if (Array.isArray(value)) {
    return value.map(stripNonCloneable).filter((v) => v !== undefined);
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const cleaned = stripNonCloneable(v);
    if (cleaned !== undefined) result[k] = cleaned;
  }
  return result;
}

function toCachedMessage(msg: ChatMessage, fallbackConvId?: string | number | null): {
  key: string;
  conversationId: string;
  messageId: string;
  sortTime: number;
  cachedAt: number;
  data: ChatMessage;
} {
  // Use the message's own ConversationId, or fall back to the one passed
  // by the caller (the conversation we're loading for). This ensures the
  // cache key is always valid even if the API didn't include ConversationId
  // on each message.
  const convId = String(msg.ConversationId ?? fallbackConvId ?? "");
  const msgId = String(msg.MessageId ?? msg.Id ?? "");
  const key = `${convId}:${msgId}`;

  const stripped = stripNonCloneable({ ...msg }) as ChatMessage;
  stripped.ConversationId = convId || stripped.ConversationId;
  for (const field of TRANSIENT_FIELDS) {
    delete (stripped as Record<string, unknown>)[field as string];
  }
  if (Array.isArray(stripped.mediaItems)) {
    stripped.mediaItems = stripped.mediaItems.map((item) =>
      item?.url?.startsWith("blob:") ? { ...item, url: "" } : item
    );
  }

  const dateTs = new Date(msg.DateTime || 0).getTime();
  const sortTime = Number.isNaN(dateTs) ? Number(msgId) || 0 : dateTs;

  return {
    key,
    conversationId: convId,
    messageId: msgId,
    sortTime,
    cachedAt: Date.now(),
    data: stripped,
  };
}

function getDbForAuth(auth: AuthData | null) {
  return getDb(auth?.id ?? auth?.userId);
}

export async function putMessages(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  messages: ChatMessage[]
): Promise<void> {
  if (!conversationId || !messages.length) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const convId = String(conversationId);
  const now = Date.now();
  const rows = messages.map((m) => {
    const cached = toCachedMessage(m, convId);
    return {
      ...cached.data,
      ...cached,
      cachedAt: now,
    };
  });

  await db.transaction("rw", db.messages, async () => {
    await db.messages.bulkPut(rows);

    const total = await db.messages.where("conversationId").equals(convId).count();
    if (total > MESSAGES_PER_CONVERSATION) {
      const toDelete = await db.messages
        .where("[conversationId+sortTime]")
        .between([convId, -Infinity], [convId, Infinity])
        .limit(total - MESSAGES_PER_CONVERSATION)
        .primaryKeys();
      await db.messages.bulkDelete(toDelete);
    }
  });

  // Global eviction: if storage is under pressure, remove oldest cached
  // entries across all conversations (LRU by cachedAt).
  await evictOldMessages(auth).catch(() => {});
}

async function evictOldMessages(auth: AuthData | null): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db) return;
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;

  const estimate = await navigator.storage.estimate();
  if (!estimate.quota || !estimate.usage) return;

  const usageRatio = estimate.usage / estimate.quota;
  if (usageRatio < 0.85) return;

  // Evict 20% of oldest messages by cachedAt to free space.
  const totalRows = await db.messages.count();
  const evictCount = Math.floor(totalRows * 0.2);
  if (evictCount === 0) return;

  const oldestKeys = await db.messages
    .orderBy("cachedAt")
    .limit(evictCount)
    .primaryKeys();
  await db.messages.bulkDelete(oldestKeys);
}

export async function getMessagesAround(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  limit = 50
): Promise<ChatMessage[]> {
  if (!conversationId) return [];
  const db = getDbForAuth(auth);
  if (!db) return [];

  const convId = String(conversationId);
  const rows = await db.messages
    .where("[conversationId+sortTime]")
    .between([convId, -Infinity], [convId, Infinity])
    .reverse()
    .limit(limit)
    .toArray();

  return rows.reverse().map(({ key, conversationId: _c, messageId: _m, sortTime: _s, cachedAt: _ca, ...data }) => data);
}

export async function getMessagesBefore(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  beforeMessageId: string | number,
  limit = 50
): Promise<ChatMessage[]> {
  if (!conversationId || !beforeMessageId) return [];
  const db = getDbForAuth(auth);
  if (!db) return [];

  const convId = String(conversationId);
  const anchorKey = `${convId}:${String(beforeMessageId)}`;
  const anchor = await db.messages.get(anchorKey);
  if (!anchor) return [];

  const rows = await db.messages
    .where("[conversationId+sortTime]")
    .between([convId, -Infinity], [convId, anchor.sortTime], true, false)
    .reverse()
    .limit(limit)
    .toArray();

  return rows.reverse().map(({ key, conversationId: _c, messageId: _m, sortTime: _s, cachedAt: _ca, ...data }) => data);
}

export async function getMessagesAfter(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  afterMessageId: string | number,
  limit = 50
): Promise<ChatMessage[]> {
  if (!conversationId || !afterMessageId) return [];
  const db = getDbForAuth(auth);
  if (!db) return [];

  const convId = String(conversationId);
  const anchorKey = `${convId}:${String(afterMessageId)}`;
  const anchor = await db.messages.get(anchorKey);
  if (!anchor) return [];

  const rows = await db.messages
    .where("[conversationId+sortTime]")
    .between([convId, anchor.sortTime], [convId, Infinity], false, true)
    .limit(limit)
    .toArray();

  return rows.map(({ key, conversationId: _c, messageId: _m, sortTime: _s, cachedAt: _ca, ...data }) => data);
}

export async function countMessages(
  auth: AuthData | null,
  conversationId: string | number | null | undefined
): Promise<number> {
  if (!conversationId) return 0;
  const db = getDbForAuth(auth);
  if (!db) return 0;
  return db.messages.where("conversationId").equals(String(conversationId)).count();
}

export async function upsertMessage(
  auth: AuthData | null,
  msg: ChatMessage
): Promise<void> {
  const convId = msg.ConversationId;
  if (convId == null) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const row = toCachedMessage(msg, convId);
  await db.messages.put({
    ...row.data,
    ...row,
    cachedAt: Date.now(),
  });
}

export async function updateMessageReaction(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  messageId: string | number | null | undefined,
  reactions: unknown
): Promise<void> {
  if (!conversationId || !messageId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const key = `${String(conversationId)}:${String(messageId)}`;
  await db.messages.update(key, (row) => {
    if (row) {
      const mutable = row as unknown as Record<string, unknown>;
      mutable.ReactionEmojis = typeof reactions === "string" ? reactions : JSON.stringify(reactions ?? []);
      row.cachedAt = Date.now();
    }
  });
}

export async function updateMessageEdit(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  messageId: string | number | null | undefined,
  newMessage: string,
  extra?: Record<string, unknown>
): Promise<void> {
  if (!conversationId || !messageId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const key = `${String(conversationId)}:${String(messageId)}`;
  await db.messages.update(key, (row) => {
    if (row) {
      const mutable = row as unknown as Record<string, unknown>;
      mutable.Message = newMessage;
      mutable.IsEdited = 1;
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          if (v != null) mutable[k] = v;
        }
      }
      row.cachedAt = Date.now();
    }
  });
}

export async function updateMessageStar(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  messageId: string | number | null | undefined,
  isStar: 0 | 1
): Promise<void> {
  if (!conversationId || !messageId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const key = `${String(conversationId)}:${String(messageId)}`;
  await db.messages.update(key, (row) => {
    if (row) {
      const mutable = row as unknown as Record<string, unknown>;
      mutable.IsStar = isStar;
      row.cachedAt = Date.now();
    }
  });
}

export async function updateMessageStatus(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  messageId: string | number | null | undefined,
  status: number,
  extra?: Partial<ChatMessage>
): Promise<void> {
  if (!conversationId || !messageId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const key = `${String(conversationId)}:${String(messageId)}`;
  await db.messages.update(key, (row) => {
    if (row) {
      row.Status = status as ChatMessage["Status"];
      row.MessageStatus = status as ChatMessage["MessageStatus"];
      if (extra) {
        const mutable = row as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(extra)) {
          if (v != null) mutable[k] = v;
        }
      }
      row.cachedAt = Date.now();
    }
  });
}

export async function deleteMessage(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  messageId: string | number | null | undefined,
  deletedInfo?: Partial<ChatMessage>
): Promise<void> {
  if (!conversationId || !messageId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const key = `${String(conversationId)}:${String(messageId)}`;
  await db.messages.update(key, (row) => {
    if (row) {
      const mutable = row as unknown as Record<string, unknown>;
      mutable.Message = deletedInfo?.Message || "This message was deleted.";
      mutable.Message1 = deletedInfo?.Message1 || "You deleted this message.";
      mutable.IsDeletedForEveryone = 1;
      mutable.DeletedAt = (deletedInfo as Record<string, unknown>)?.DeletedAt as string || new Date().toISOString();
      mutable.MessageType = "text";
      row.cachedAt = Date.now();
    }
  });
}

export async function clearConversation(
  auth: AuthData | null,
  conversationId: string | number | null | undefined
): Promise<void> {
  if (!conversationId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const convId = String(conversationId);
  await db.transaction("rw", db.messages, async () => {
    const keys = await db.messages
      .where("conversationId")
      .equals(convId)
      .primaryKeys();
    await db.messages.bulkDelete(keys);
  });
}
