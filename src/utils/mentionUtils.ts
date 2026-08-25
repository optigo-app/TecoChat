// ─── Mention utilities ───────────────────────────────────────────────────────
// Helpers for parsing MentionUsers JSON and checking if a user is mentioned.
// Used by the mute-notification flow to decide if a mention should override mute.

interface MentionEntry {
  MentionedUserId?: string | number;
  MentionText?: string;
  /** 1 = specific user, 2 = @all */
  MentionType?: number;
}

/**
 * Parse the MentionUsers JSON string into an array of mention entries.
 * Returns an empty array on parse failure or empty input.
 */
export const parseMentionUsers = (
  mentionUsersJson: string | undefined | null
): MentionEntry[] => {
  if (!mentionUsersJson) return [];
  try {
    const parsed = typeof mentionUsersJson === "string"
      ? JSON.parse(mentionUsersJson)
      : mentionUsersJson;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Check if a specific user is mentioned in the MentionUsers JSON.
 *
 * A user is considered mentioned if:
 * - Their UserId matches any MentionedUserId, OR
 * - There is an @all mention (MentionType === 2) — all group members are mentioned
 *
 * @param mentionUsersJson  JSON string from message.MentionUsers / message.Mentions
 * @param currentUserId     The current logged-in user's id
 * @returns true if the user is mentioned (or @all is used)
 */
export const checkIfUserMentioned = (
  mentionUsersJson: string | undefined | null,
  currentUserId: string | number | undefined | null
): boolean => {
  if (!currentUserId) return false;
  const mentions = parseMentionUsers(mentionUsersJson);
  if (mentions.length === 0) return false;

  const myId = String(currentUserId);
  return mentions.some((m) => {
    // @all mention — everyone is mentioned
    if (Number(m.MentionType) === 2) return true;
    // Specific user mention
    return String(m.MentionedUserId ?? "") === myId;
  });
};

/**
 * Check if a conversation is currently muted and the mute hasn't expired.
 *
 * @param isMuted       IsMuted field from conversation (0 or 1)
 * @param muteExpiresAt ISO datetime string or null (null = always)
 * @returns true if the conversation is muted AND the mute is still active
 */
export const isConversationMuted = (
  isMuted: number | undefined | null,
  muteExpiresAt: string | null | undefined
): boolean => {
  if (Number(isMuted) !== 1) return false;
  // null/empty expiry = "always" muted
  if (!muteExpiresAt) return true;
  // Check if the mute hasn't expired yet
  return new Date(muteExpiresAt).getTime() > Date.now();
};
