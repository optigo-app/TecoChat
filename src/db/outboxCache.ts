"use client";

import { getDb } from "./tecoDb";
import type { ChatMessage } from "../types/message";
import type { AuthData } from "../context/LoginData";
import type { OutboxMediaFile, OutboxMessage } from "./tecoDb";

function getDbForAuth(auth: AuthData | null) {
  return getDb(auth?.id ?? auth?.userId);
}

export async function addToOutbox(
  auth: AuthData | null,
  msg: ChatMessage,
  text: string,
  replyTo?: string | number | null,
  mentionUsers?: string | null,
  media?: {
    type: string;
    files: OutboxMediaFile[];
    receiverId?: string | number | string[] | number[] | null;
    memberIds?: number[];
    isGroup?: boolean;
    time?: string;
    date?: string;
    dateTime?: string;
    conversationName?: string;
  }
): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db) return;

  const convId = String(msg.ConversationId ?? "");
  const msgId = String(msg.MessageId ?? msg.Id ?? "");
  if (!convId || !msgId) return;

  const entry: OutboxMessage = {
    key: `${convId}:${msgId}`,
    conversationId: convId,
    messageId: msgId,
    text,
    replyTo: String(replyTo ?? "").trim() || null,
    mentionUsers: mentionUsers ?? null,
    mediaType: media?.type ?? null,
    mediaFiles: media?.files,
    receiverId: media?.receiverId,
    memberIds: media?.memberIds,
    isGroup: media?.isGroup,
    time: media?.time,
    date: media?.date,
    dateTime: media?.dateTime,
    conversationName: media?.conversationName,
    createdAt: Date.now(),
    status: "pending",
    attempts: 0,
    data: msg,
  };
  await db.outbox.put(entry);
}

export async function updateOutboxStatus(
  auth: AuthData | null,
  conversationId: string | number,
  messageId: string | number,
  status: "pending" | "sending" | "failed"
): Promise<boolean> {
  const db = getDbForAuth(auth);
  if (!db) return false;
  const key = `${String(conversationId)}:${String(messageId)}`;
  const existing = await db.outbox.get(key);
  if (!existing) return false;
  await db.outbox.update(key, {
    status,
    attempts: (existing.attempts ?? 0) + 1,
  });
  return true;
}

export async function removeFromOutbox(
  auth: AuthData | null,
  conversationId: string | number,
  messageId: string | number
): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db) return;
  await db.outbox.delete(`${String(conversationId)}:${String(messageId)}`);
}

export async function getPendingOutbox(
  auth: AuthData | null,
  conversationId?: string | number
): Promise<OutboxMessage[]> {
  const db = getDbForAuth(auth);
  if (!db) return [];
  const rows = conversationId
    ? await db.outbox
        .where("conversationId")
        .equals(String(conversationId))
        .toArray()
    : await db.outbox.toArray();

  // Remove stale entries that have no text and no media (should never be sent)
  const invalid = rows.filter(
    (row) =>
      !row.text?.trim() &&
      (!row.mediaFiles || row.mediaFiles.length === 0) &&
      !row.replyTo
  );
  if (invalid.length > 0) {
    console.log("[OUTBOX] Removing", invalid.length, "stale empty outbox entries");
    await db.outbox.bulkDelete(invalid.map((r) => r.key));
  }

  const validRows = rows.filter((r) => !invalid.includes(r));
  const staleSendingCutoff = Date.now() - 60_000;
  return validRows
    .filter((row) =>
      row.status === "pending" ||
      row.status === "failed" ||
      (row.status === "sending" && row.createdAt < staleSendingCutoff)
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getSyncState(
  auth: AuthData | null,
  conversationId: string | number
): Promise<{ lastMessageId: string | null; lastSyncedAt: number } | null> {
  const db = getDbForAuth(auth);
  if (!db) return null;
  const row = await db.syncState.get(String(conversationId));
  if (!row) return null;
  return {
    lastMessageId: row.lastSequence != null ? String(row.lastSequence) : null,
    lastSyncedAt: row.lastSyncedAt,
  };
}

export async function setSyncState(
  auth: AuthData | null,
  conversationId: string | number,
  lastMessageId: string | number | null
): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db) return;
  await db.syncState.put({
    conversationId: String(conversationId),
    oldestCursor: null,
    newestCursor: null,
    hasOlder: false,
    hasNewer: false,
    lastSequence: lastMessageId != null ? Number(lastMessageId) : null,
    lastSyncedAt: Date.now(),
    cachedAt: Date.now(),
  });
}
