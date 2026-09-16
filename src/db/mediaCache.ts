"use client";

import { getDb } from "./tecoDb";
import type { AuthData } from "../contexts/LoginData";

const MAX_MEDIA_ENTRIES = 500;
const MAX_TOTAL_MEDIA_BYTES = 100 * 1024 * 1024;

function getDbForAuth(auth: AuthData | null) {
  return getDb(auth?.id ?? auth?.userId);
}

export async function getMediaBlob(
  auth: AuthData | null,
  key: string
): Promise<Blob | null> {
  const db = getDbForAuth(auth);
  if (!db || !key) return null;
  const row = await db.mediaCache.get(key);
  return row?.blob ?? null;
}

export async function getMediaUrl(
  auth: AuthData | null,
  key: string
): Promise<string | null> {
  const blob = await getMediaBlob(auth, key);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function putMediaBlob(
  auth: AuthData | null,
  key: string,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db || !key) return;

  await db.transaction("rw", db.mediaCache, async () => {
    await db.mediaCache.put({
      key,
      blob,
      mimeType,
      size: blob.size,
      cachedAt: Date.now(),
    });

    const total = await db.mediaCache.count();
    if (total > MAX_MEDIA_ENTRIES) {
      const toDelete = await db.mediaCache
        .orderBy("cachedAt")
        .limit(total - MAX_MEDIA_ENTRIES)
        .primaryKeys();
      await db.mediaCache.bulkDelete(toDelete);
    }

    const rows = await db.mediaCache.toArray();
    const totalSize = rows.reduce((sum, r) => sum + r.size, 0);
    if (totalSize > MAX_TOTAL_MEDIA_BYTES) {
      const oldest = await db.mediaCache
        .orderBy("cachedAt")
        .limit(Math.floor(total * 0.3))
        .primaryKeys();
      await db.mediaCache.bulkDelete(oldest);
    }
  });
}

export async function fetchAndCacheMedia(
  auth: AuthData | null,
  key: string,
  url: string
): Promise<string | null> {
  const existing = await getMediaUrl(auth, key);
  if (existing) return existing;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    await putMediaBlob(auth, key, blob, blob.type);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function clearMediaCache(
  auth: AuthData | null,
  conversationId?: string | number
): Promise<void> {
  const db = getDbForAuth(auth);
  if (!db) return;
  await db.mediaCache.clear();
}
