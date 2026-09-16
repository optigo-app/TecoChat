"use client";

import { getDb } from "./tecoDb";
import type { AuthData } from "../contexts/LoginData";

type GroupMember = {
  UserId?: number;
  userId?: number;
  id?: number;
  MemberName?: string;
  ProfileImage?: string;
  IsGroupAdmin?: number;
};

function getDbForAuth(auth: AuthData | null) {
  return getDb(auth?.id ?? auth?.userId);
}

function normalizeUserId(member: GroupMember): string {
  return String(member.UserId ?? member.userId ?? member.id ?? "");
}

export async function putMembers(
  auth: AuthData | null,
  conversationId: string | number,
  members: GroupMember[]
): Promise<void> {
  if (!conversationId || !members.length) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  const convId = String(conversationId);
  const now = Date.now();
  const rows = members.map((m) => ({
    ...m,
    conversationId: convId,
    userId: normalizeUserId(m),
    cachedAt: now,
  }));

  await db.transaction("rw", db.groupMembers, async () => {
    await db.groupMembers.where("conversationId").equals(convId).delete();
    await db.groupMembers.bulkPut(rows);
  });
}

export async function getMembers(
  auth: AuthData | null,
  conversationId: string | number
): Promise<GroupMember[]> {
  if (!conversationId) return [];
  const db = getDbForAuth(auth);
  if (!db) return [];

  const rows = await db.groupMembers
    .where("conversationId")
    .equals(String(conversationId))
    .toArray();

  return rows.map(({ conversationId: _c, userId: _u, cachedAt: _ca, ...data }) => data as GroupMember);
}

export async function clearMembers(
  auth: AuthData | null,
  conversationId: string | number
): Promise<void> {
  if (!conversationId) return;
  const db = getDbForAuth(auth);
  if (!db) return;

  await db.groupMembers.where("conversationId").equals(String(conversationId)).delete();
}
