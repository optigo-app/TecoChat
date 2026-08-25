/**
 * Converts a raw emoji character into its unified hex string format.
 * Handles ZWJ sequences and skin tone variations.
 */
export const charToUnified = (char: string | null | undefined): string | null => {
  if (!char) return null;
  try {
    return Array.from(char)
      .map((c) => c.codePointAt(0)?.toString(16))
      .filter((hex) => hex !== "fe0f")
      .join("-");
  } catch {
    return null;
  }
};

/**
 * Parses the raw ReactionEmojis string into a JSON array.
 */
export const parseReactions = (
  rawString: string | null | undefined
): Array<{ Reaction?: string; Emoji?: string; Unified?: string; Direction?: number; UserId?: number; UserName?: string }> => {
  try {
    if (!rawString || rawString === "" || rawString === "[]") return [];
    const raw = JSON.parse(rawString);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};
