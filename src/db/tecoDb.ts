"use client";

import { Dexie, type Table } from "dexie";
import type { ChatMessage } from "../types/message";

type GroupMember = {
  UserId?: number;
  userId?: number;
  id?: number;
  MemberName?: string;
  ProfileImage?: string;
  IsGroupAdmin?: number;
};

export interface CachedMessage extends ChatMessage {
  key: string;
  conversationId: string;
  messageId: string;
  sortTime: number;
  cachedAt: number;
}

export interface CachedConversation extends Record<string, unknown> {
  conversationId: string;
  lastUpdatedDate?: string;
  isPinned?: number;
  cachedAt: number;
}

export interface CachedGroupMember extends Record<string, unknown> {
  conversationId: string;
  userId: string;
  cachedAt: number;
}

export interface CachedDraft {
  conversationId: string;
  text: string;
  cachedAt: number;
}

export interface SyncState {
  conversationId: string;
  oldestCursor: number | null;
  newestCursor: number | null;
  hasOlder: boolean;
  hasNewer: boolean;
  lastSequence: number | null;
  lastSyncedAt: number;
  cachedAt: number;
}

export interface OutboxMediaFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  blob: Blob;
  width?: number;
  height?: number;
}

export interface OutboxMessage {
  key: string;
  conversationId: string;
  messageId: string;
  text: string;
  replyTo?: string | number | null;
  mentionUsers?: string | null;
  mediaType?: string | null;
  mediaFiles?: OutboxMediaFile[];
  receiverId?: string | number | string[] | number[] | null;
  memberIds?: number[];
  isGroup?: boolean;
  time?: string;
  date?: string;
  dateTime?: string;
  conversationName?: string;
  createdAt: number;
  status: "pending" | "sending" | "failed";
  attempts: number;
  data: ChatMessage;
}

export interface SearchCacheEntry {
  key: string;
  conversationId: string;
  query: string;
  results: ChatMessage[];
  cachedAt: number;
}

export interface MediaCacheEntry {
  key: string;
  blob: Blob;
  mimeType: string;
  size: number;
  cachedAt: number;
}

export class TecoChatDatabase extends Dexie {
  messages!: Table<CachedMessage, string>;
  conversations!: Table<CachedConversation, string>;
  groupMembers!: Table<CachedGroupMember, [string, string]>;
  drafts!: Table<CachedDraft, string>;
  syncState!: Table<SyncState, string>;
  outbox!: Table<OutboxMessage, string>;
  searchCache!: Table<SearchCacheEntry, string>;
  mediaCache!: Table<MediaCacheEntry, string>;

  constructor(authId: string) {
    super(`tecochat_${authId}`);
    this.version(1).stores({
      messages:
        "&key, conversationId, messageId, [conversationId+messageId], [conversationId+sortTime], cachedAt",
      conversations:
        "&conversationId, lastUpdatedDate, isPinned, cachedAt",
      groupMembers: "&[conversationId+userId], conversationId, cachedAt",
      drafts: "&conversationId, cachedAt",
      syncState: "&conversationId, cachedAt",
    });
    this.version(2).stores({
      outbox: "&key, conversationId, status, createdAt",
    });
    this.version(3).stores({
      searchCache: "&key, conversationId, query, cachedAt",
      mediaCache: "&key, cachedAt, size",
    });
  }
}

const activeDatabases = new Map<string, TecoChatDatabase>();

export function getDb(authId: string | number | undefined | null): TecoChatDatabase | null {
  if (typeof indexedDB === "undefined" || !authId) return null;
  const id = String(authId);
  if (!activeDatabases.has(id)) {
    activeDatabases.set(id, new TecoChatDatabase(id));
  }
  return activeDatabases.get(id) ?? null;
}

export function closeDb(authId: string | number | undefined | null): void {
  const id = String(authId ?? "");
  const db = activeDatabases.get(id);
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    activeDatabases.delete(id);
  }
}

export async function deleteDb(authId: string | number | undefined | null): Promise<void> {
  if (typeof indexedDB === "undefined" || !authId) return;
  const id = String(authId);
  closeDb(id);
  try {
    await Dexie.delete(`tecochat_${id}`);
  } catch {
    /* ignore */
  }
}
