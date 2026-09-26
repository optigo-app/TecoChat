"use client";

import { getDb } from "./tecoDb";
import type { CachedConversation } from "./tecoDb";
import type { ConversationListEntry } from "../types/conversation";
import type { AuthData } from "../contexts/LoginData";

function getDbForAuth(auth: AuthData | null) {
  return getDb(auth?.id ?? auth?.userId);
}

function isCloneable(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const t = typeof value;
  if (t === "function" || t === "symbol") return false;
  if (t !== "object") return true;
  if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) return false;
  if (Array.isArray(value)) return value.every(isCloneable);
  const obj = value as Record<string, unknown>;
  if (obj.$$typeof != null) return false;
  return Object.values(obj).every(isCloneable);
}

function stripNonCloneable(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "function" || typeof value === "symbol") continue;
    if (value !== null && typeof value === "object") {
      if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) continue;
      const $$typeof = (value as Record<string, unknown>)?.$$typeof;
      if ($$typeof != null) continue;
      if (Array.isArray(value)) {
        result[key] = value.filter(isCloneable);
        continue;
      }
      if (isCloneable(value)) {
        result[key] = value;
      }
      continue;
    }
    result[key] = value;
  }
  return result;
}

function toCachedConversation(entry: ConversationListEntry): CachedConversation {
  const cleaned = stripNonCloneable(entry as unknown as Record<string, unknown>) as Record<string, unknown>;
  return {
    ...cleaned,
    conversationId: String((entry as any).ConversationId ?? ""),
    lastUpdatedDate: (entry as any).LastUpdatedDate ?? (entry as any).LastMessageDate ?? (entry as any).DateTime,
    isPinned: (entry as any).IsPin ?? 0,
    cachedAt: Date.now(),
  } as CachedConversation;
}

export async function putConversations(
  auth: AuthData | null,
  conversations: ConversationListEntry[]
): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db || !conversations.length) return;

  console.log("[CACHE] Writing", conversations.length, "conversations to IndexedDB for auth:", auth?.id ?? auth?.userId);
  const rows = conversations.map(toCachedConversation);
  await db.conversations.clear();
  await db.conversations.bulkPut(rows);
}

export async function getConversations(
  auth: AuthData | null
): Promise<ConversationListEntry[]> {
  const db = getDbForAuth(auth);
  if (!db) return [];

  const rows = await db.conversations.toArray();
  return rows
    .sort((a, b) => {
      const pinDiff = (b.isPinned ?? 0) - (a.isPinned ?? 0);
      if (pinDiff !== 0) return pinDiff;
      const aDate = String(a.lastUpdatedDate ?? "");
      const bDate = String(b.lastUpdatedDate ?? "");
      return bDate.localeCompare(aDate);
    })
    .map(({ conversationId, lastUpdatedDate, isPinned, cachedAt, ...data }) => data as ConversationListEntry);
}

export async function upsertConversation(
  auth: AuthData | null,
  conversation: ConversationListEntry
): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db) return;

  const cached = toCachedConversation(conversation);
  await db.conversations.put(cached);
}

export async function deleteConversation(
  auth: AuthData | null,
  conversationId: string | number | null | undefined
): Promise<void> {
  if (!conversationId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  await db.conversations.delete(String(conversationId));
}

