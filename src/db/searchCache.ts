"use client";

import { getDb } from "./tecoDb";
import type { ChatMessage } from "../types/message";
import type { AuthData } from "../contexts/LoginData";

const SEARCH_CACHE_TTL = 5 * 60 * 1000;

function getDbForAuth(auth: AuthData | null) {
  return getDb(auth?.id ?? auth?.userId);
}

function makeKey(conversationId: string | number, query: string): string {
  return `${String(conversationId)}:${query.toLowerCase().trim()}`;
}

export async function getSearchCache(
  auth: AuthData | null,
  conversationId: string | number,
  query: string
): Promise<ChatMessage[] | null> {
  const db = getDbForAuth(auth);
  if (!db) return null;

  const row = await db.searchCache.get(makeKey(conversationId, query));
  if (!row) return null;

  if (Date.now() - row.cachedAt > SEARCH_CACHE_TTL) {
    await db.searchCache.delete(row.key).catch(() => {});
    return null;
  }
  return row.results;
}

export async function setSearchCache(
  auth: AuthData | null,
  conversationId: string | number,
  query: string,
  results: ChatMessage[]
): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db || !results.length) return;

  await db.searchCache.put({
    key: makeKey(conversationId, query),
    conversationId: String(conversationId),
    query: query.toLowerCase().trim(),
    results,
    cachedAt: Date.now(),
  });
}

