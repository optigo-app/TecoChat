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
 * Parses ReactionEmojis into a JSON array. Accepts a JSON string OR an
 * already-parsed array — socket/normalization paths can store it either way,
 * and a plain JSON.parse on an array throws (hiding the reaction badge).
 */
export const parseReactions = (
  raw: unknown
): Array<{ Reaction?: string; Emoji?: string; Unified?: string; Direction?: number; UserId?: number | string; UserName?: string }> => {
  try {
    if (!raw || raw === "" || raw === "[]") return [];
    if (Array.isArray(raw)) {
      // Server keeps removed reactions as { Reaction: "" } placeholders —
      // drop them so empty pills don't render.
      return raw.filter((r) => !!r && !!(r.Reaction || r.Emoji));
    }
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed)
      ? parsed.filter((r: { Reaction?: string; Emoji?: string }) => !!r && !!(r.Reaction || r.Emoji))
      : [];
  } catch {
    return [];
  }
};
