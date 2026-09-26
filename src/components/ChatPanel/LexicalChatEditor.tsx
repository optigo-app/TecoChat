"use client";

import React, { useEffect, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { $generateNodesFromDOM } from "@lexical/html";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode, $isListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import {
  COMMAND_PRIORITY_NORMAL,
  FORMAT_TEXT_COMMAND,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $getSelection,
  $isRangeSelection,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type LexicalEditor,
} from "lexical";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { MentionNode } from "./input/MentionNode";
import MentionPlugin from "./input/MentionPlugin";
import { EmojiNode } from "./input/EmojiNode";
import EmojiPlugin from "./input/EmojiPlugin";
import type { MentionData } from "./input/MentionPlugin";
import type { MentionMember } from "./input/MentionDropdown";

import "./LexicalChatEditor.scss";

const theme = {
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    strikethrough: "editor-text-strikethrough",
    code: "editor-text-code",
  },
  quote: "editor-quote",
  list: {
    ul: "editor-list-ul",
    ol: "editor-list-ol",
    listitem: "editor-listitem",
  },
  mention: "editor-mention-chip",
};

// ── Markdown export + value tracking plugin (merged) ────────────────────────
// Single update listener that both emits onChange AND tracks lastEmittedValue.
// Debounced via requestAnimationFrame to avoid $convertToMarkdownString on
// every keystroke (which caused 242ms beforeinput violations).
function MarkdownExportPlugin({
  onChange,
  lastEmittedRef,
}: {
  onChange?: (markdown: string) => void;
  lastEmittedRef?: React.MutableRefObject<string>;
}) {
  const [editor] = useLexicalComposerContext();
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const onChangeRef = useRef(onChange);
  const lastEmittedRefRef = useRef(lastEmittedRef);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    lastEmittedRefRef.current = lastEmittedRef;
  }, [lastEmittedRef]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
      // Debounce: cancel previous frame, schedule new one.
      // This coalesces rapid keystrokes into a single markdown conversion.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        editorState.read(() => {
          const markdown = $convertToMarkdownString(TRANSFORMERS, undefined, true);
          lastEmittedRefRef.current?.current !== undefined && (lastEmittedRefRef.current.current = markdown);
          onChangeRef.current?.(markdown);
        });
      });
    });
  }, [editor]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return null;
}

// ── Editor ref plugin ────────────────────────────────────────────────────────
function EditorRefPlugin({ editorRef }: { editorRef?: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);
  return null;
}

// ── Selection tracker plugin ─────────────────────────────────────────────────
// Keeps a serialized copy of the last RangeSelection so callers (e.g. emoji
// insertion) can restore the cursor after the editor blurs — mobile taps on
// the emoji button blur the editor and lose the selection.
export interface SavedSelectionPoint {
  key: string;
  offset: number;
  type: "text" | "element";
}
export interface SavedSelection {
  anchor: SavedSelectionPoint;
  focus: SavedSelectionPoint;
}

function SelectionTrackerPlugin({
  selectionRef,
}: {
  selectionRef?: React.MutableRefObject<SavedSelection | null>;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!selectionRef) return;
    return editor.registerUpdateListener(({ editorState }) => {
      // Only persist the selection while the DOM selection is actually inside
      // the editor. Programmatic updates (draft import, root.clear, node
      // transforms) can leave a state selection at offset 0 — persisting that
      // would make emoji restore insert at the start of the text.
      const rootEl = editor.getRootElement();
      const domSel = window.getSelection();
      if (
        !rootEl ||
        !domSel ||
        domSel.rangeCount === 0 ||
        !rootEl.contains(domSel.anchorNode) ||
        !rootEl.contains(domSel.focusNode)
      ) {
        return;
      }
      editorState.read(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          selectionRef.current = {
            anchor: { key: sel.anchor.key, offset: sel.anchor.offset, type: sel.anchor.type },
            focus: { key: sel.focus.key, offset: sel.focus.offset, type: sel.focus.type },
          };
        }
      });
    });
  }, [editor, selectionRef]);
  return null;
}

// ── Enter key plugin ─────────────────────────────────────────────────────────
function EnterKeyPlugin({
  onEnter,
  submitOnEnter = true,
}: {
  onEnter?: (event: KeyboardEvent | null) => void;
  submitOnEnter?: boolean;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        let insideList = false;
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const node = selection.anchor.getNode();
            let current = node;
            while (current) {
              if ($isListItemNode(current)) {
                insideList = true;
                break;
              }
              const parent = current.getParent();
              if (!parent) break;
              current = parent as typeof current;
            }
          }
        });

        // Ctrl+Enter or Cmd+Enter ALWAYS submits
        if (event && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          onEnter?.(event);
          return true;
        }

        if (event && event.shiftKey) {
          return false; // Let Lexical handle Shift+Enter (soft newline)
        }

        if (insideList) {
          return false; // Let Lexical handle Enter inside list
        }

        if (submitOnEnter) {
          event?.preventDefault();
          onEnter?.(event || null);
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, onEnter, submitOnEnter]);

  return null;
}

// ── One-time formatting plugin ───────────────────────────────────────────────
function OneTimeFormattingPlugin() {
  const [editor] = useLexicalComposerContext();
  const justFormattedRef = useRef(false);

  useEffect(() => {
    const unregisterCommand = editor.registerCommand(
      FORMAT_TEXT_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) && !selection.isCollapsed()) {
            justFormattedRef.current = true;
          }
        });
        return false;
      },
      COMMAND_PRIORITY_NORMAL
    );

    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
      if (!justFormattedRef.current) return;

      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && selection.isCollapsed()) {
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel) && sel.isCollapsed()) {
              const node = sel.anchor.getNode();
              const offset = sel.anchor.offset;
              if (offset === node.getTextContentSize() || offset === 0) {
                sel.format = 0;
              }
            }
          });
          justFormattedRef.current = false;
        }
      });
    });

    return () => {
      unregisterCommand();
      unregisterUpdate();
    };
  }, [editor]);

  return null;
}

// ── Markdown → HTML converter for paste ──────────────────────────────────────
// Converts inline markdown markers (**bold**, *italic*, ~~strike~~, `code`,
// ***bold+italic***) to HTML so $generateNodesFromDOM can create formatted
// Lexical nodes. Used when pasting plain text that contains markdown markers
// (e.g. ChatGPT plain-text fallback, WhatsApp text/plain).
const escapeHtmlForPaste = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const markdownLineToHtml = (line: string): string => {
  if (!line) return "";
  // Regex order: longest markers first (*** before ** before *, ___ before __ before _, ~~ before ~)
  const regex = /(```[\s\S]*?```|`[^`]+`|\*\*\*\S(?:.*?\S)?\*\*\*|\*\*\S(?:.*?\S)?\*\*|\*\S(?:.*?\S)?\*|___\S(?:.*?\S)?___|__\S(?:.*?\S)?__|_\S(?:.*?\S)?_|~~\S(?:.*?\S)?~~|~\S(?:.*?\S)?~)/g;
  const parts = line.split(regex);
  return parts
    .map((part) => {
      if (!part) return "";
      // Code block
      if (part.startsWith("```") && part.endsWith("```")) {
        return `<pre><code>${escapeHtmlForPaste(part.slice(3, -3))}</code></pre>`;
      }
      // Inline code — literal content
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return `<code>${escapeHtmlForPaste(part.slice(1, -1))}</code>`;
      }
      // Bold + Italic
      if ((part.startsWith("***") && part.endsWith("***")) || (part.startsWith("___") && part.endsWith("___"))) {
        return `<strong><em>${markdownLineToHtml(part.slice(3, -3))}</em></strong>`;
      }
      // Bold
      if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
        return `<strong>${markdownLineToHtml(part.slice(2, -2))}</strong>`;
      }
      // Italic
      if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
        return `<em>${markdownLineToHtml(part.slice(1, -1))}</em>`;
      }
      // Strikethrough
      if ((part.startsWith("~~") && part.endsWith("~~")) || (part.startsWith("~") && part.endsWith("~"))) {
        const start = part.startsWith("~~") ? 2 : 1;
        const end = part.startsWith("~~") ? -2 : -1;
        return `<del>${markdownLineToHtml(part.slice(start, end))}</del>`;
      }
      // Plain text — escape HTML
      return escapeHtmlForPaste(part);
    })
    .join("");
};

// ── Paste handler plugin ─────────────────────────────────────────────────────
interface PasteHandlerPluginProps {
  maxChars?: number;
  onPasteTextOverflow?: (text: string) => void;
  onPasteFiles?: (files: File[]) => void;
  captureMessageScrollState?: () => void;
}

function PasteHandlerPlugin({
  maxChars,
  onPasteTextOverflow,
  onPasteFiles,
  captureMessageScrollState,
}: PasteHandlerPluginProps) {
  const [editor] = useLexicalComposerContext();
  const overflowRef = useRef(onPasteTextOverflow);
  const filesRef = useRef(onPasteFiles);
  const scrollRef = useRef(captureMessageScrollState);
  const maxCharsRef = useRef(maxChars);

  useEffect(() => {
    overflowRef.current = onPasteTextOverflow;
  }, [onPasteTextOverflow]);
  useEffect(() => {
    filesRef.current = onPasteFiles;
  }, [onPasteFiles]);
  useEffect(() => {
    scrollRef.current = captureMessageScrollState;
  }, [captureMessageScrollState]);
  useEffect(() => {
    maxCharsRef.current = maxChars;
  }, [maxChars]);

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const clipboardEvent = event as ClipboardEvent;
        if (!clipboardEvent || !clipboardEvent.clipboardData) return false;

        const files = Array.from(clipboardEvent.clipboardData.files || []) as File[];
        if (files.length > 0) {
          scrollRef.current?.();
          filesRef.current?.(files);
          return false;
        }

        // Prefer text/html from rich editors (ChatGPT, Gmail, Word, our own copy).
        // Rich editors put formatted content in text/html and a plain-text fallback
        // in text/plain. We convert the HTML to Lexical nodes so the editor shows
        // formatted text (bold, italic, etc.) instead of literal ** or * markers.
        const html = clipboardEvent.clipboardData.getData("text/html");
        const text = clipboardEvent.clipboardData.getData("text") || clipboardEvent.clipboardData.getData("text/plain");
        if (!text && !html) return false;

        const limit = maxCharsRef.current;
        if (limit && text.length > limit) {
          clipboardEvent.preventDefault();
          overflowRef.current?.(text);
          return true;
        }

        clipboardEvent.preventDefault();

        // Build an HTML string to import:
        // - If we have HTML from a rich editor, use it directly.
        // - If we only have plain text, convert markdown markers (**bold**, *italic*,
        //   ~~strike~~, `code`, etc.) to HTML so Lexical imports them as formatted
        //   text instead of literal marker characters.
        //   Paragraph breaks (blank lines) become <p> tags; single newlines become <br>.
        let htmlToImport = html;
        if (!htmlToImport || !htmlToImport.trim()) {
          // Plain text paste — split into paragraphs on double-newline, then
          // convert markdown markers to HTML within each paragraph.
          // Single newlines within a paragraph become <br> for line breaks.
          const paragraphs = text.split(/\n{2,}/);
          htmlToImport = paragraphs
            .map((para) => {
              const lines = para.split("\n").map((line) => markdownLineToHtml(line));
              return `<p>${lines.join("<br>")}</p>`;
            })
            .join("");
        }

        editor.update(() => {
          // Parse the HTML and generate Lexical nodes from it.
          // $generateNodesFromDOM returns nodes WITHOUT replacing the root,
          // so we can insert them at the current selection.
          const dom = new DOMParser().parseFromString(htmlToImport, "text/html");
          const nodes = $generateNodesFromDOM(editor, dom);

          const selection = $getSelection();
          if ($isRangeSelection(selection) && nodes.length > 0) {
            selection.insertNodes(nodes);
          } else if (nodes.length > 0) {
            const root = $getRoot();
            root.append(...nodes);
          } else {
            // Fallback: insert as plain text
            const sel = $getSelection();
            if ($isRangeSelection(sel)) {
              sel.insertNodes([$createTextNode(text)]);
            } else {
              const paragraph = $createParagraphNode();
              paragraph.append($createTextNode(text));
              $getRoot().append(paragraph);
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}

// ── External value sync plugin ───────────────────────────────────────────────
// Only syncs from props when syncKey (conversationId) changes — NOT on every
// keystroke. The MarkdownExportPlugin already emits via onChange, so we only
// need to import external values when switching conversations or restoring drafts.
function ExternalValueSyncPlugin({
  value,
  syncKey,
  lastEmittedRef,
}: {
  value: string;
  syncKey?: string | number;
  lastEmittedRef: React.MutableRefObject<string>;
}) {
  const [editor] = useLexicalComposerContext();
  const lastSyncKey = useRef(syncKey);

  useEffect(() => {
    const normalize = (s: string) => (s || "").replace(/\n+$/, "").trimStart();
    const syncKeyChanged = syncKey !== lastSyncKey.current;
    // Only import from props when the conversation changed OR the external
    // value differs from what the editor itself last emitted (e.g. draft restore).
    if (syncKeyChanged || normalize(value) !== normalize(lastEmittedRef.current)) {
      editor.update(() => {
        if (!value) {
          const root = $getRoot();
          root.clear();
          root.append($createParagraphNode());
        } else {
          // shouldPreserveNewLines = true keeps blank lines between paragraphs
          // so spacing is preserved when editing/restoring drafts.
          $convertFromMarkdownString(value, TRANSFORMERS, undefined, true);
        }
      });
      lastSyncKey.current = syncKey;
      lastEmittedRef.current = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value, syncKey]);

  return null;
}

// ── Main component ───────────────────────────────────────────────────────────
interface LexicalChatEditorProps {
  value?: string;
  onChange?: (markdown: string) => void;
  onKeyDown?: (event: KeyboardEvent | null) => void;
  placeholder?: string;
  className?: string;
  editorRef?: React.MutableRefObject<LexicalEditor | null>;
  syncKey?: string | number;
  hasDraft?: boolean;
  maxChars?: number;
  onPasteTextOverflow?: (text: string) => void;
  onPasteFiles?: (files: File[]) => void;
  captureMessageScrollState?: () => void;
  namespace?: string;
  submitOnEnter?: boolean;
  mentionMembers?: MentionMember[];
  onMentionsChange?: (mentions: MentionData[]) => void;
  excludeUserId?: string | number;
  onFetchMembers?: () => void;
  isGroup?: boolean;
  /** Receives the last RangeSelection so callers can restore the cursor after blur */
  selectionRef?: React.MutableRefObject<SavedSelection | null>;
}

const LexicalChatEditorComponent: React.FC<LexicalChatEditorProps> = ({
  value = "",
  onChange,
  onKeyDown,
  placeholder = "Type a message...",
  className,
  editorRef,
  syncKey,
  hasDraft = false,
  maxChars,
  onPasteTextOverflow,
  onPasteFiles,
  captureMessageScrollState,
  namespace = "WhatsAppChatEditor",
  submitOnEnter = true,
  mentionMembers = [],
  onMentionsChange,
  excludeUserId,
  onFetchMembers,
  isGroup = false,
  selectionRef,
}) => {
  const initialConfig = {
    namespace,
    theme,
    onError: (error: Error) => console.error(error),
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      MentionNode,
      EmojiNode,
    ],
  };

  // Shared ref: MarkdownExportPlugin writes the last emitted markdown here,
  // ExternalValueSyncPlugin reads it to decide if an external import is needed.
  // This avoids a SECOND $convertToMarkdownString call per keystroke.
  const lastEmittedRef = useRef("");

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={`lexical-editor-container ${className || ""}`}>
        <RichTextPlugin
          contentEditable={<ContentEditable className="lexical-content-editable" />}
          placeholder={
            !hasDraft ? <div className="lexical-placeholder">{placeholder}</div> : null
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <ClearEditorPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <EmojiPlugin />
        <MarkdownExportPlugin onChange={onChange} lastEmittedRef={lastEmittedRef} />
        <EditorRefPlugin editorRef={editorRef} />
        <SelectionTrackerPlugin selectionRef={selectionRef} />
        <EnterKeyPlugin onEnter={onKeyDown} submitOnEnter={submitOnEnter} />
        <OneTimeFormattingPlugin />
        <PasteHandlerPlugin
          maxChars={maxChars}
          onPasteTextOverflow={onPasteTextOverflow}
          onPasteFiles={onPasteFiles}
          captureMessageScrollState={captureMessageScrollState}
        />
        <ExternalValueSyncPlugin value={value} syncKey={syncKey} lastEmittedRef={lastEmittedRef} />
        {isGroup && (
          <MentionPlugin
            members={mentionMembers}
            onMentionsChange={onMentionsChange}
            excludeUserId={excludeUserId}
            onFetchMembers={onFetchMembers}
          />
        )}
      </div>
    </LexicalComposer>
  );
};

export const LexicalChatEditor = React.memo(LexicalChatEditorComponent);
