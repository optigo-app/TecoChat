"use client";

// Person-open intent — set when a conversation open is triggered by an
// explicit "go chat with this person / see the new message" action (mention
// click, member "Message" action, @all popover pick, notification tap)
// rather than tapping a row in the conversation list. The message loader
// consumes the flag and skips the first-unread anchor so the chat lands on
// the latest message instead of mid-history.
//
// Keyed by conversation id with a TTL: a flag is only valid for the open
// that immediately follows the click — a stale flag (e.g. the conversation
// never actually opened) expires instead of suppressing the unread anchor
// on a later unrelated open.
const pending = new Map<string, number>();
const TTL_MS = 30_000;

export function markOpenAtLatest(
  conversationId: string | number | null | undefined
): void {
  if (conversationId == null) return;
  pending.set(String(conversationId), Date.now());
}

export function consumeOpenAtLatest(
  conversationId: string | number | null | undefined
): boolean {
  if (conversationId == null) return false;
  const key = String(conversationId);
  const ts = pending.get(key);
  if (ts == null) return false;
  pending.delete(key);
  return Date.now() - ts < TTL_MS;
}
