"use client";

import { getDb } from "./tecoDb";
import type { CachedMessage } from "./tecoDb";
import type { ChatMessage } from "../types/message";
import type { AuthData } from "../contexts/LoginData";

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
  const msgId = String(msg.MessageId ?? msg.Id ?? msg.ClientMessageId ?? "");
  const key = `${convId}:${msgId}`;

  const stripped = stripNonCloneable({ ...msg }) as ChatMessage;
  stripped.ConversationId = convId || stripped.ConversationId;
  // Canonicalize stored identity: a temp/optimistic Id must not survive into
  // the cache once a real server id exists (it would poison data-message-id
  // and anchor lookups on reload).
  const srvId = stripped.MessageId;
  if (srvId != null && String(srvId) !== "") {
    const idStr = String(stripped.Id ?? "");
    if (!idStr || !/^\d+$/.test(idStr)) {
      stripped.Id = srvId;
    }
  }
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

/** Every cache key this message could have been written under by an older
 *  or differently-shaped payload — `conv:MessageId`, `conv:Id`,
 *  `conv:ClientMessageId`. Deleting these before a write kills orphan rows. */
function aliasKeysFor(
  msg: ChatMessage,
  convId: string,
  canonicalKey: string
): string[] {
  const keys = new Set<string>();
  for (const v of [msg.MessageId, msg.Id, msg.ClientMessageId]) {
    const s = v == null ? "" : String(v);
    if (s) keys.add(`${convId}:${s}`);
  }
  keys.delete(canonicalKey);
  return [...keys];
}

/** All identity values present on a stored row (canonical key + data aliases). */
function rowAliases(row: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const v of [row.messageId, row.MessageId, row.Id, row.ClientMessageId]) {
    const s = v == null ? "" : String(v);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** Rows sharing any identity alias are the same logical message cached under
 *  different key shapes (orphan-key duplicates). Returns the winners plus the
 *  keys to delete. Winner = latest cachedAt. */
function splitDupRows<T extends { key: string; cachedAt: number }>(
  rows: T[]
): { rows: T[]; dupKeys: string[] } {
  const byAlias = new Map<string, T>();
  const keep: T[] = [];
  const dupKeys: string[] = [];
  for (const row of rows) {
    const aliases = rowAliases(row as unknown as Record<string, unknown>);
    let existing: T | undefined;
    for (const a of aliases) {
      const e = byAlias.get(a);
      if (e) {
        existing = e;
        break;
      }
    }
    if (!existing) {
      keep.push(row);
      for (const a of aliases) byAlias.set(a, row);
      continue;
    }
    // Prefer the row stored under its canonical key (conv:MessageId) —
    // an alias-keyed row may carry staler content. cachedAt breaks ties.
    const canonOf = (r: T) => {
      const o = r as unknown as Record<string, unknown>;
      const id = String(o.MessageId ?? o.Id ?? o.ClientMessageId ?? "");
      return `${String(o.conversationId ?? "")}:${id}`;
    };
    const rowCanon = row.key === canonOf(row);
    const existCanon = existing.key === canonOf(existing);
    const winner =
      rowCanon !== existCanon
        ? rowCanon
          ? row
          : existing
        : row.cachedAt >= existing.cachedAt
        ? row
        : existing;
    const loser = winner === row ? existing : row;
    dupKeys.push(loser.key);
    const i = keep.indexOf(existing);
    if (i >= 0) keep[i] = winner;
    for (const a of rowAliases(winner as unknown as Record<string, unknown>)) {
      byAlias.set(a, winner);
    }
  }
  return { rows: keep, dupKeys };
}

/** Resolve a stored row by any id shape — direct canonical key first, then
 *  an alias scan scoped to the conversation (rare path, bounded by conv size). */
async function findMessageRow(
  db: NonNullable<ReturnType<typeof getDb>>,
  convId: string,
  messageId: string | number
) {
  const key = `${convId}:${String(messageId)}`;
  const direct = await db.messages.get(key);
  if (direct) return direct;
  const idStr = String(messageId);
  const s = (v: unknown) => (v == null ? "" : String(v));
  return db.messages
    .where("conversationId")
    .equals(convId)
    .filter(
      (r) =>
        s(r.MessageId) === idStr ||
        s(r.Id) === idStr ||
        s(r.ClientMessageId) === idStr
    )
    .first();
}

function getDbForAuth(auth: AuthData | null) {
  return getDb(auth?.id ?? auth?.userId);
}

/** Temp/optimistic rows must never be persisted — a pending bubble written to
 *  IDB would reappear as a stuck "sending" ghost after reload alongside the
 *  real message. */
const isTransientMessage = (msg: ChatMessage): boolean => {
  const status = msg.Status as unknown;
  if (status === "pending" || status === 4 || status === "4" || status === "failed") return true;
  const msgId = String(msg.MessageId ?? msg.Id ?? "");
  if (!msgId || msgId.startsWith("temp_")) return true;
  // Optimistic ids are `${Date.now()}-${Math.random()}` — server ids are numeric.
  if (!/^\d+$/.test(msgId) && msg.ClientMessageId) return true;
  return false;
};

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
  const rows: CachedMessage[] = [];
  const staleAliasKeys = new Set<string>();
  for (const m of messages) {
    if (isTransientMessage(m)) continue;
    const cached = toCachedMessage(m, convId);
    for (const k of aliasKeysFor(m, convId, cached.key)) staleAliasKeys.add(k);
    rows.push({
      ...cached.data,
      ...cached,
      cachedAt: now,
    });
  }
  if (!rows.length) return;

  await db.transaction("rw", db.messages, async () => {
    // Delete alias keys first — the same logical message may exist under a
    // different id shape from an earlier payload (orphan-key duplicate).
    if (staleAliasKeys.size) {
      await db.messages.bulkDelete([...staleAliasKeys]);
    }
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

let lastEvictCheck = 0;
async function evictOldMessages(auth: AuthData | null): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db) return;
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
  // storage.estimate() is not free — throttle to once per minute.
  const now = Date.now();
  if (now - lastEvictCheck < 60000) return;
  lastEvictCheck = now;

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

  // Self-heal: orphan-key duplicates (same message under conv:Id and
  // conv:MessageId) are removed here so legacy caches repair on open.
  const { rows: deduped, dupKeys } = splitDupRows(rows);
  if (dupKeys.length) db.messages.bulkDelete(dupKeys).catch(() => {});

  return deduped.reverse().map(({ key, conversationId: _c, messageId: _m, sortTime: _s, cachedAt: _ca, ...data }) => data);
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
  const anchor = await findMessageRow(db, convId, beforeMessageId);
  if (!anchor) return [];

  // Inclusive bound + post-filter: rows sharing the anchor's sortTime (media
  // batches can share DateTime) must not all be dropped — index order is
  // (conversationId, sortTime, key), so a row is "before" the anchor iff
  // sortTime < anchor.sortTime, or equal sortTime with a smaller key.
  const rows = await db.messages
    .where("[conversationId+sortTime]")
    .between([convId, -Infinity], [convId, anchor.sortTime], true, true)
    .reverse()
    .limit(limit + 25)
    .toArray();

  const before = rows.filter(
    (r) =>
      r.key !== anchor.key &&
      (r.sortTime < anchor.sortTime ||
        (r.sortTime === anchor.sortTime && r.key < anchor.key))
  );
  const { rows: deduped, dupKeys } = splitDupRows(before.slice(0, limit));
  if (dupKeys.length) db.messages.bulkDelete(dupKeys).catch(() => {});

  return deduped.reverse().map(({ key, conversationId: _c, messageId: _m, sortTime: _s, cachedAt: _ca, ...data }) => data);
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
  const anchor = await findMessageRow(db, convId, afterMessageId);
  if (!anchor) return [];

  const rows = await db.messages
    .where("[conversationId+sortTime]")
    .between([convId, anchor.sortTime], [convId, Infinity], true, true)
    .limit(limit + 25)
    .toArray();

  const after = rows.filter(
    (r) =>
      r.key !== anchor.key &&
      (r.sortTime > anchor.sortTime ||
        (r.sortTime === anchor.sortTime && r.key > anchor.key))
  );
  const { rows: deduped, dupKeys } = splitDupRows(after.slice(0, limit));
  if (dupKeys.length) db.messages.bulkDelete(dupKeys).catch(() => {});

  return deduped.map(({ key, conversationId: _c, messageId: _m, sortTime: _s, cachedAt: _ca, ...data }) => data);
}

export async function upsertMessage(
  auth: AuthData | null,
  msg: ChatMessage
): Promise<void> {
  const convId = msg.ConversationId;
  if (convId == null || isTransientMessage(msg)) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const convIdStr = String(convId);
  const row = toCachedMessage(msg, convId);
  const staleKeys = aliasKeysFor(msg, convIdStr, row.key);
  await db.transaction("rw", db.messages, async () => {
    // Drop any copy of this message stored under another id shape so the
    // update can't create an orphan-key duplicate.
    if (staleKeys.length) await db.messages.bulkDelete(staleKeys);
    await db.messages.put({
      ...row.data,
      ...row,
      cachedAt: Date.now(),
    });
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

  const row = await findMessageRow(db, String(conversationId), messageId);
  if (!row) return;
  await db.messages.update(row.key, (r) => {
    if (r) {
      const mutable = r as unknown as Record<string, unknown>;
      mutable.ReactionEmojis = typeof reactions === "string" ? reactions : JSON.stringify(reactions ?? []);
      r.cachedAt = Date.now();
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

  const row = await findMessageRow(db, String(conversationId), messageId);
  if (!row) return;
  await db.messages.update(row.key, (r) => {
    if (r) {
      const mutable = r as unknown as Record<string, unknown>;
      mutable.Message = newMessage;
      mutable.IsEdited = 1;
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          if (v != null) mutable[k] = v;
        }
      }
      r.cachedAt = Date.now();
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

  const row = await findMessageRow(db, String(conversationId), messageId);
  if (!row) return;
  await db.messages.update(row.key, (r) => {
    if (r) {
      const mutable = r as unknown as Record<string, unknown>;
      mutable.IsStar = isStar;
      r.cachedAt = Date.now();
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

  const row = await findMessageRow(db, String(conversationId), messageId);
  if (!row) return;
  await db.messages.update(row.key, (r) => {
    if (r) {
      r.Status = status as ChatMessage["Status"];
      r.MessageStatus = status as ChatMessage["MessageStatus"];
      if (extra) {
        const mutable = r as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(extra)) {
          if (v != null) mutable[k] = v;
        }
      }
      r.cachedAt = Date.now();
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

  const row = await findMessageRow(db, String(conversationId), messageId);
  if (!row) return;
  await db.messages.update(row.key, (r) => {
    if (r) {
      const mutable = r as unknown as Record<string, unknown>;
      mutable.Message = deletedInfo?.Message || "This message was deleted.";
      mutable.Message1 = deletedInfo?.Message1 || "You deleted this message.";
      mutable.IsDeletedForEveryone = 1;
      mutable.DeletedAt = (deletedInfo as Record<string, unknown>)?.DeletedAt as string || new Date().toISOString();
      mutable.MessageType = "text";
      r.cachedAt = Date.now();
    }
  });
}

export async function deleteMessageRow(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  messageId: string | number | null | undefined
): Promise<void> {
  if (!conversationId || !messageId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const row = await findMessageRow(db, String(conversationId), messageId);
  if (row) await db.messages.delete(row.key);
}

// Throttle the per-conversation dedupe sweep — once per conv per minute.
const dedupeSweepAt = new Map<string, number>();

/** Scan a conversation's cached rows, collapse alias duplicates and re-key
 *  rows stored under a stale id shape. Called on conversation load/refresh
 *  so a refresh click actually repairs the cache instead of just re-reading
 *  duplicate rows. */
export async function dedupeConversationCache(
  auth: AuthData | null,
  conversationId: string | number | null | undefined
): Promise<void> {
  if (!conversationId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const convId = String(conversationId);
  const now = Date.now();
  if (now - (dedupeSweepAt.get(convId) ?? 0) < 60000) return;
  dedupeSweepAt.set(convId, now);

  const rows = await db.messages
    .where("conversationId")
    .equals(convId)
    .toArray();
  if (!rows.length) return;

  const { rows: winners, dupKeys } = splitDupRows(rows);
  const toDelete = new Set<string>(dupKeys);
  const rekeys: Array<typeof rows[number]> = [];

  for (const row of winners) {
    const canonical = String(row.MessageId ?? row.Id ?? row.ClientMessageId ?? "");
    const canonicalKey = `${convId}:${canonical}`;
    if (canonical && row.key !== canonicalKey) {
      toDelete.add(row.key);
      rekeys.push({ ...row, key: canonicalKey, messageId: canonical });
    }
  }

  await db.transaction("rw", db.messages, async () => {
    if (toDelete.size) await db.messages.bulkDelete([...toDelete]);
    if (rekeys.length) await db.messages.bulkPut(rekeys);
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
