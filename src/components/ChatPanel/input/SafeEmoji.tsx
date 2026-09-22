"use client";

import React from "react";
import { EmojiStyle } from "emoji-picker-react";

const CDN_URL_APPLE = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/";

const emojiImageErrorCache = new Set<string>();

export interface SafeEmojiProps {
  unified: string;
  emoji: string;
  size?: number;
  emojiStyle?: EmojiStyle;
  /**
   * When true, the emoji participates in text selection so the selection
   * highlight paints over it instead of breaking around it. Use inside
   * selectable/editable text (Lexical decorator, message bubbles).
   */
  userSelectable?: boolean;
}

export const SafeEmoji = React.memo(function SafeEmoji({
  unified,
  emoji,
  size = 20,
  emojiStyle = EmojiStyle.APPLE,
  userSelectable = false,
}: SafeEmojiProps) {
  const [error, setError] = React.useState(() => emojiImageErrorCache.has(unified));

  React.useEffect(() => {
    setError(emojiImageErrorCache.has(unified));
  }, [unified]);

  const handleError = React.useCallback(() => {
    emojiImageErrorCache.add(unified);
    setError(true);
  }, []);

  // NATIVE style always uses the OS font — no CDN image needed
  if (emojiStyle === EmojiStyle.NATIVE || error) {
    return (
      <span
        style={{
          display: "inline-block",
          fontSize: `${size}px`,
          lineHeight: 1,
          verticalAlign: "middle",
          margin: "0 1px",
          userSelect: userSelectable ? "text" : "none",
          pointerEvents: "none",
          fontFamily:
            '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Twemoji Mozilla", "Noto Color Emoji", "EmojiOne Color", "Android Emoji"',
        }}
      >
        {emoji}
      </span>
    );
  }

  const src = `${CDN_URL_APPLE}${unified}.png`;

  return (
    <img
      src={src}
      alt={emoji}
      draggable={false}
      onError={handleError}
      style={{
        display: "inline-block",
        width: `${size}px`,
        height: `${size}px`,
        verticalAlign: "middle",
        margin: "0 1px",
        userSelect: userSelectable ? "text" : "none",
        pointerEvents: "none",
      }}
    />
  );
});

export default SafeEmoji;
