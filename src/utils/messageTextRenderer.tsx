"use client";

import React from "react";
import { EmojiStyle } from "emoji-picker-react";
import { SafeEmoji } from "../components/ChatPanel/input/SafeEmoji";
import { charToUnified } from "./EmojiUtils";
import { inspectUrl } from "./urlSecurity";

function safeUrl(raw: string): string | null {
  const result = inspectUrl(raw);
  if (result.level === "danger" && !result.safe) {
    if (result.href === "about:blank") return null;
  }
  return result.href;
}

const highlightQueryInText = (text: string, query?: string): React.ReactNode => {
  if (!query || !text) return renderEmojiText(text);
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span
          key={`hl-${i}`}
          className="search-highlight"
          style={{
            color: "var(--color-search-highlight)",
            backgroundColor: "var(--color-search-highlight-bg)",
            fontWeight: 600,
            borderRadius: "3px",
            padding: "0 2px",
          }}
        >
          {renderEmojiText(part)}
        </span>
      ) : (
        <React.Fragment key={`hl-${i}`}>{renderEmojiText(part)}</React.Fragment>
      )
    );
  } catch {
    return renderEmojiText(text);
  }
};

const formatChatText = (text: string, highlightQuery?: string): React.ReactNode => {
  if (!text || typeof text !== "string") return text;

  const regex = /(```[\s\S]*?```|`[^`]+`|\*\*\*\S(?:.*?\S)?\*\*\*|\*\*\S(?:.*?\S)?\*\*|\*_\S(?:.*?\S)?_\*|___\S(?:.*?\S)?___|__\S(?:.*?\S)?__|_\*\S(?:.*?\S)?\*_|\*\S(?:.*?\S)?\*|_\S(?:.*?\S)?_|~~\S(?:.*?\S)?~~|~\S(?:.*?\S)?~|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("```") && part.endsWith("```")) {
      return (
        <code
          key={index}
          style={{
            fontFamily: "monospace",
            backgroundColor: "rgba(0,0,0,0.06)",
            padding: "2px 4px",
            borderRadius: "4px",
            fontSize: "13px",
          }}
        >
          {part.slice(3, -3)}
        </code>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={index}
          style={{
            fontFamily: "monospace",
            backgroundColor: "rgba(0,0,0,0.06)",
            padding: "1px 3px",
            borderRadius: "3px",
            fontSize: "13px",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const safeHref = safeUrl(linkMatch[2]);
      if (!safeHref) {
        return <React.Fragment key={index}>{linkMatch[1]}</React.Fragment>;
      }
      return (
        <a
          key={index}
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-bubble-link)", textDecoration: "underline", wordBreak: "break-word" }}
        >
          {linkMatch[1]}
        </a>
      );
    }

    if (
      (part.startsWith("***") && part.endsWith("***")) ||
      (part.startsWith("___") && part.endsWith("___"))
    ) {
      return (
        <strong key={index}>
          <em>{formatChatText(part.slice(3, -3), highlightQuery)}</em>
        </strong>
      );
    }
    if (
      (part.startsWith("*_") && part.endsWith("_*")) ||
      (part.startsWith("_*") && part.endsWith("*_"))
    ) {
      return (
        <strong key={index}>
          <em>{formatChatText(part.slice(2, -2), highlightQuery)}</em>
        </strong>
      );
    }

    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={index}>{formatChatText(part.slice(2, -2), highlightQuery)}</strong>;
    }

    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={index}>{formatChatText(part.slice(1, -1), highlightQuery)}</em>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={index}>{formatChatText(part.slice(1, -1), highlightQuery)}</em>;
    }

    if ((part.startsWith("~~") && part.endsWith("~~")) || (part.startsWith("~") && part.endsWith("~"))) {
      const sliceStart = part.startsWith("~~") ? 2 : 1;
      const sliceEnd = part.startsWith("~~") ? -2 : -1;
      return <del key={index}>{formatChatText(part.slice(sliceStart, sliceEnd), highlightQuery)}</del>;
    }

    // Plain text — apply search highlight if query provided
    return <React.Fragment key={index}>{highlightQueryInText(part, highlightQuery)}</React.Fragment>;
  });
};

/**
 * Convert WhatsApp/Markdown-formatted text to an HTML string for clipboard use.
 * Used by the Copy message action so that pasting into rich editors (ChatGPT,
 * Gmail, Word, etc.) preserves formatting, while pasting into WhatsApp preserves
 * the markdown markers (via text/plain).
 *
 * Escapes HTML-unsafe characters first, then applies inline formatting.
 * Code blocks and inline code are NOT formatted (literal content, per WhatsApp spec).
 */
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatChatTextToHtml = (text: string): string => {
  if (!text || typeof text !== "string") return "";

  const regex = /(```[\s\S]*?```|`[^`]+`|\*\*\*\S(?:.*?\S)?\*\*\*|\*\*\S(?:.*?\S)?\*\*|\*_\S(?:.*?\S)?_\*|___\S(?:.*?\S)?___|__\S(?:.*?\S)?__|_\*\S(?:.*?\S)?\*_|\*\S(?:.*?\S)?\*|_\S(?:.*?\S)?_|~~\S(?:.*?\S)?~~|~\S(?:.*?\S)?~)/g;
  const parts = text.split(regex);

  return parts
    .map((part) => {
      if (!part) return "";

      // Code block — literal content
      if (part.startsWith("```") && part.endsWith("```")) {
        return `<code style="font-family:monospace;background-color:rgba(0,0,0,0.06);padding:2px 4px;border-radius:4px">${escapeHtml(part.slice(3, -3))}</code>`;
      }
      // Inline code — literal content
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return `<code style="font-family:monospace;background-color:rgba(0,0,0,0.06);padding:1px 3px;border-radius:3px">${escapeHtml(part.slice(1, -1))}</code>`;
      }
      // Bold + Italic
      if (
        (part.startsWith("***") && part.endsWith("***")) ||
        (part.startsWith("___") && part.endsWith("___"))
      ) {
        return `<strong><em>${formatChatTextToHtml(part.slice(3, -3))}</em></strong>`;
      }
      if (
        (part.startsWith("*_") && part.endsWith("_*")) ||
        (part.startsWith("_*") && part.endsWith("*_"))
      ) {
        return `<strong><em>${formatChatTextToHtml(part.slice(2, -2))}</em></strong>`;
      }
      // Bold
      if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
        return `<strong>${formatChatTextToHtml(part.slice(2, -2))}</strong>`;
      }
      // Italic
      if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
        return `<em>${formatChatTextToHtml(part.slice(1, -1))}</em>`;
      }
      // Strikethrough
      if ((part.startsWith("~~") && part.endsWith("~~")) || (part.startsWith("~") && part.endsWith("~"))) {
        const sliceStart = part.startsWith("~~") ? 2 : 1;
        const sliceEnd = part.startsWith("~~") ? -2 : -1;
        return `<del>${formatChatTextToHtml(part.slice(sliceStart, sliceEnd))}</del>`;
      }
      // Plain text — escape HTML
      return escapeHtml(part);
    })
    .join("");
};

/**
 * Convert a full message (possibly multi-line) to HTML for clipboard.
 * Preserves line breaks as <br>.
 */
export const messageTextToHtml = (text: string | null | undefined): string => {
  if (!text || typeof text !== "string") return "";
  return text
    .split("\n")
    .map((line) => formatChatTextToHtml(line))
    .join("<br>");
};

/**
 * Heading font sizes for # through ######
 */
const HEADING_SIZES: Record<number, number> = {
  1: 24,
  2: 22,
  3: 20,
  4: 18,
  5: 16,
  6: 15,
};

/**
 * Parse a single line for block-level markdown (headings, blockquotes, list items).
 * Returns { node, consumed } where consumed means the line was handled.
 */
const renderLine = (line: string, lineIndex: number, highlightQuery?: string): React.ReactNode => {
  // Heading: # text, ## text, ### text, etc.
  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const content = headingMatch[2];
    const fontSize = HEADING_SIZES[level] || 15;
    return (
      <span key={`h-${lineIndex}`} style={{ fontSize, fontWeight: 700, display: "block", margin: "2px 0 1px" }}>
        {formatChatText(content, highlightQuery)}
      </span>
    );
  }

  // Blockquote: > text
  const quoteMatch = line.match(/^>\s*(.*)$/);
  if (quoteMatch) {
    return (
      <span key={`q-${lineIndex}`} style={{ borderLeft: "3px solid rgba(115,103,240,0.4)", paddingLeft: "8px", display: "block", color: "inherit", opacity: 0.85 }}>
        {formatChatText(quoteMatch[1], highlightQuery)}
      </span>
    );
  }

  // Unordered list: - text, * text
  // Avoid matching **bold** or *italic* lines — only treat * as bullet when
  // the line doesn't end with * (italic) and doesn't start with ** (bold)
  const ulMatch = line.match(/^([-*])\s+(.+)$/);
  if (ulMatch && !line.match(/^\*\*/) && !line.match(/\*$/) && !line.match(/_\s*$/)) {
    return (
      <span key={`ul-${lineIndex}`} style={{ display: "block", paddingLeft: "14px", position: "relative", lineHeight: 1.4, margin: 0 }}>
        <span style={{ position: "absolute", left: "2px", top: 0 }}>•</span>
        {formatChatText(ulMatch[2], highlightQuery)}
      </span>
    );
  }

  // Ordered list: 1. text
  const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
  if (olMatch) {
    return (
      <span key={`ol-${lineIndex}`} style={{ display: "block", paddingLeft: "18px", position: "relative", lineHeight: 1.4, margin: 0 }}>
        <span style={{ position: "absolute", left: "2px", top: 0 }}>{olMatch[1]}.</span>
        {formatChatText(olMatch[2], highlightQuery)}
      </span>
    );
  }

  // Horizontal rule: --- or ___
  if (/^(-{3,}|_{3,})$/.test(line.trim())) {
    return <hr key={`hr-${lineIndex}`} style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.15)", margin: "4px 0" }} />;
  }

  return null;
};

export interface MentionInfo {
  MentionedUserId: string | number;
  MentionText: string;
  MentionType: number;
}

/**
 * Parse MentionUsers JSON string from backend into array.
 * Format: [{"MentionedUserId":9,"MentionText":"@Elvish Bhai","MentionType":1}]
 */
const parseMentionUsers = (raw: string | undefined | null): MentionInfo[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as MentionInfo[];
  } catch {
    // ignore parse errors
  }
  return [];
};

/**
 * Highlight @mentions in text using MentionText from the API.
 * Returns React nodes with mentions wrapped in styled spans.
 */
const highlightMentions = (text: string, mentions: MentionInfo[], highlightQuery?: string): React.ReactNode => {
  if (!mentions.length || !text) return formatChatText(text, highlightQuery);

  // Build a regex that matches any mention text (sorted longest-first to avoid partial matches)
  const sorted = [...mentions]
    .filter((m) => m.MentionText)
    .sort((a, b) => b.MentionText.length - a.MentionText.length);
  if (!sorted.length) return formatChatText(text, highlightQuery);

  const escaped = sorted.map((m) => m.MentionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");

  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (!part) return null;
    const mention = sorted.find((m) => m.MentionText === part);
    if (mention) {
      const isAllMention = mention.MentionType === 2 || String(mention.MentionedUserId) === "";
      // WhatsApp-style: separate @ from the name, @ is dimmer
      const atSymbol = part.startsWith("@") ? "@" : "";
      const nameText = atSymbol ? part.slice(1) : part;
      return (
        <span
          key={`mention-${index}`}
          className="message-mention-highlight"
          data-mention-user-id={mention.MentionedUserId}
          data-mention-type={mention.MentionType}
          style={{
            color: "var(--color-mention-text)",
            fontWeight: 700,
            cursor: "pointer",
            borderRadius: "4px",
            padding: "0 2px",
            display: "inline",
            backgroundColor: "transparent",
            transition: "background-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-mention-hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isAllMention) {
              // Show all group members dropdown
              window.dispatchEvent(
                new CustomEvent("SHOW_ALL_MENTIONS", {
                  detail: {
                    anchorEl: e.currentTarget as HTMLElement,
                    mentionText: mention.MentionText,
                  },
                })
              );
            } else {
              // Dispatch MENTION_CLICK — ChatPanel looks up the member in
              // groupMembers and redirects to their chat (SELECT_CONVERSATION)
              // or opens Contact Info (SHOW_MEMBER_INFO) if no conversation
              // exists. This mirrors the sender-name click behavior.
              window.dispatchEvent(
                new CustomEvent("MENTION_CLICK", {
                  detail: {
                    mentionedUserId: mention.MentionedUserId,
                    mentionText: mention.MentionText,
                    mentionType: mention.MentionType,
                  },
                })
              );
            }
          }}
        >
          {atSymbol && (
            <span className="at-symbol" style={{ color: "var(--color-mention-at)" }}>
              {atSymbol}
            </span>
          )}
          {renderEmojiText(nameText)}
        </span>
      );
    }
    return <React.Fragment key={`text-${index}`}>{formatChatText(part, highlightQuery)}</React.Fragment>;
  });
};

/**
 * Render message text WhatsApp-style:
 * - Split by \n
 * - Each line: check block-level markdown (headings, quotes, lists, hr)
 *   then linkify URLs + format inline WhatsApp/Markdown text
 *   then highlight @mentions using MentionUsers metadata
 * - Join lines with <br>
 * - Container uses white-space: pre-wrap for spaces
 *
 * Supports markdown features produced by the Lexical editor:
 * - Headings: # H1, ## H2, ### H3, etc.
 * - Blockquotes: > text
 * - Unordered lists: - text, * text
 * - Ordered lists: 1. text
 * - Horizontal rules: ---
 * - Bold: **text** / __text__
 * - Italic: *text* / _text_
 * - Strikethrough: ~~text~~ / ~text~
 * - Code: `text` / ```block```
 * - Links: [text](url)
 */
export const renderMessageText = (
  rawText: string | null | undefined,
  mentionUsers?: string | null,
  highlightQuery?: string
): React.ReactNode => {
  const text = rawText == null ? "" : String(rawText);
  if (!text) return "";

  const mentions = parseMentionUsers(mentionUsers ?? undefined);
  const urlRegex = /(?:https?:\/\/|www\.)[^\s]+/gi;
  const lines = text.split("\n");

  return lines.map((line, lineIndex) => {
    // Check block-level markdown first (headings, quotes, lists, hr)
    const blockNode = renderLine(line, lineIndex, highlightQuery);
    if (blockNode) {
      // Block elements (display:block) already break the line — only add <br>
      // for headings/hr which need extra separation. Lists and quotes stay tight.
      const isHeading = line.match(/^#{1,6}\s+/);
      const isHr = /^(-{3,}|_{3,})$/.test(line.trim());
      return (
        <React.Fragment key={`line-${lineIndex}`}>
          {blockNode}
          {(isHeading || isHr) && lineIndex < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      );
    }

    // Normal line: linkify URLs + inline formatting + mention highlights
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex = 0;

    for (const match of line.matchAll(urlRegex)) {
      const matchedUrl = match[0];
      const start = match.index ?? 0;
      const end = start + matchedUrl.length;

      // Text before the URL (with mention highlights)
      if (start > lastIndex) {
        nodes.push(
          <React.Fragment key={`t-${lineIndex}-${matchIndex}`}>
            {highlightMentions(line.slice(lastIndex, start), mentions, highlightQuery)}
          </React.Fragment>
        );
      }

      // The URL link
      const trimmed = matchedUrl.match(/^(.*?)([\]\[\)\}>,.!?:;]+)?$/);
      const urlPart = trimmed?.[1] ?? matchedUrl;
      const trailing = trimmed?.[2] ?? "";
      const safeHref = safeUrl(urlPart);

      if (!safeHref) {
        // Dangerous scheme — render as plain text
        nodes.push(
          <React.Fragment key={`u-${lineIndex}-${matchIndex}`}>
            {urlPart}
            {trailing}
          </React.Fragment>
        );
      } else {
        nodes.push(
          <React.Fragment key={`u-${lineIndex}-${matchIndex}`}>
            <a href={safeHref} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-bubble-link)", textDecoration: "underline", wordBreak: "break-word" }}>
              {urlPart}
            </a>
            {trailing}
          </React.Fragment>
        );
      }

      lastIndex = end;
      matchIndex += 1;
    }

    // Remaining text after last URL (or entire line if no URL) — with mention highlights
    if (lastIndex < line.length) {
      nodes.push(
        <React.Fragment key={`e-${lineIndex}`}>
          {highlightMentions(line.slice(lastIndex), mentions, highlightQuery)}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={`line-${lineIndex}`}>
        {nodes}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
};

// ── Emoji text renderer (ported from old EmojiRenderer.js) ───────────────────

const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3)/u;

export function renderEmojiText(
  text: string | null | undefined,
  options: { size?: number; emojiStyle?: EmojiStyle } = {}
): React.ReactNode {
  const { size = 20, emojiStyle = EmojiStyle.APPLE } = options;

  if (!text || typeof text !== "string") return text as React.ReactNode;

  const parts = typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), ({ segment }) => segment)
    : Array.from(text);

  return parts.map((part, index) => {
    if (EMOJI_REGEX.test(part)) {
      const unified = charToUnified(part);
      if (unified) {
        return (
          <span
            key={`emoji-${index}`}
            style={{
              display: "inline-flex",
              verticalAlign: "middle",
              margin: "0 1px",
              lineHeight: 0,
            }}
          >
            <SafeEmoji
              unified={unified}
              emoji={part}
              size={size}
              emojiStyle={emojiStyle}
              userSelectable
            />
          </span>
        );
      }
    }
    return part;
  });
}

// ── Highlight search text (ported from old globalFunc.js) ────────────────────

export const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query) return text;
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span
          key={i}
          className="search-highlight"
          style={{
            color: "var(--color-search-highlight)",
            backgroundColor: "var(--color-search-highlight-bg)",
            fontWeight: 600,
            borderRadius: "3px",
            padding: "0 2px",
          }}
        >
          {renderEmojiText(part)}
        </span>
      ) : (
        <React.Fragment key={i}>{renderEmojiText(part)}</React.Fragment>
      )
    );
  } catch {
    return text;
  }
};
