"use client";

import { getDb } from "./tecoDb";
import type { AuthData } from "../contexts/LoginData";

function getDbForAuth(auth: AuthData | null) {
  return getDb(auth?.id ?? auth?.userId);
}

export async function setDraft(
  auth: AuthData | null,
  conversationId: string | number | null | undefined,
  text: string
): Promise<void> {
  if (!conversationId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const convId = String(conversationId);
  if (!text || !text.trim()) {
    await db.drafts.delete(convId);
    return;
  }

  await db.drafts.put({
    conversationId: convId,
    text: text.trim(),
    cachedAt: Date.now(),
  });
}

export async function getDraft(
  auth: AuthData | null,
  conversationId: string | number | null | undefined
): Promise<string> {
  if (!conversationId) return "";
  const db = getDbForAuth(auth);
  if (!db) return "";

  const row = await db.drafts.get(String(conversationId));
  return row?.text ?? "";
}

export async function deleteDraft(
  auth: AuthData | null,
  conversationId: string | number | null | undefined
): Promise<void> {
  if (!conversationId) return;
  const db = getDbForAuth(auth);
  if (!db) return;
  await db.drafts.delete(String(conversationId));
}

export async function getAllDrafts(
  auth: AuthData | null
): Promise<Record<string, string>> {
  const db = getDbForAuth(auth);
  if (!db) return {};

  const rows = await db.drafts.toArray();
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.text) map[row.conversationId] = row.text;
  }
  return map;
}
