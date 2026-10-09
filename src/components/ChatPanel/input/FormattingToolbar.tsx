"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Box, Tooltip, IconButton } from "@mui/material";
import { Bold, Italic, Strikethrough, Code, ListOrdered, List, Quote, MoreVertical } from "lucide-react";
import {
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $getRoot,
  type TextFormatType,
  type ElementFormatType,
} from "lexical";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
} from "@lexical/list";
import { $isQuoteNode } from "@lexical/rich-text";
import type { LexicalEditor } from "lexical";

interface FormattingToolbarProps {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  position: { top: number; left: number };
}

const FORMAT_OPTIONS = [
  { id: "bold", icon: Bold, label: "Bold", shortcut: "Ctrl+B" },
  { id: "italic", icon: Italic, label: "Italic", shortcut: "Ctrl+I" },
  { id: "strikethrough", icon: Strikethrough, label: "Strikethrough", shortcut: "Ctrl+Shift+X" },
  { id: "code", icon: Code, label: "Inline Code", shortcut: "Ctrl+Shift+C" },
  { id: "numbered", icon: ListOrdered, label: "Numbered List", shortcut: "Type '1. '" },
  { id: "bulleted", icon: List, label: "Bulleted List", shortcut: "Type '* '" },
  { id: "quote", icon: Quote, label: "Quote", shortcut: "Type '> '" },
] as const;

type FormatId = (typeof FORMAT_OPTIONS)[number]["id"];

// Mobile selection menu — WhatsApp shows plain TEXT items (Cut / Copy /
// Select all) with formatting tucked behind the "more" (⋮) button. The
// web can't extend the OS-native selection menu, so our toolbar mirrors
// that layout: text items + ⋮ toggling to the format group.
const MOBILE_CLIPBOARD = ["cut", "copy", "paste", "selectAll"] as const;
const CLIPBOARD_LABELS: Record<string, string> = {
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
  selectAll: "Select all",
};
const MOBILE_FORMAT = ["bold", "italic", "strikethrough", "code"] as const;
const FORMAT_ICONS: Record<string, typeof Bold> = {
  bold: Bold,
  italic: Italic,
  strikethrough: Strikethrough,
  code: Code,
};

// Shared style for the text menu items (WhatsApp context-menu look).
const menuItemSx = {
  px: 1.5,
  py: 1,
  fontSize: 14,
  fontWeight: 500,
  color: "#4a4a4a",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  borderRadius: "8px",
  userSelect: "none" as const,
  WebkitUserSelect: "none" as const,
  "&:hover": { background: "#f5f5f5" },
  "&:active": { transform: "scale(0.96)" },
};

// Approximate half-width of the toolbar pill — used to keep the centered
// popover inside the viewport on narrow screens.
const TOOLBAR_HALF_WIDTH = 150;
const VIEWPORT_GUTTER = 8;

const FormattingToolbarComponent = ({ editorRef, position }: FormattingToolbarProps) => {
  const [activeFormats, setActiveFormats] = useState<Record<FormatId, boolean>>(
    () => ({}) as Record<FormatId, boolean>
  );

  // Track the selection's current formats so chips show an active state —
  // WhatsApp highlights e.g. Bold when the selected text is already bold.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const update = () => {
      editor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) {
          setActiveFormats({} as Record<FormatId, boolean>);
          return;
        }
        let listType: string | null = null;
        let quote = false;
        const anchorNode = sel.anchor.getNode();
        for (const node of anchorNode.getParents()) {
          if ($isListNode(node)) listType = node.getListType();
          else if ($isQuoteNode(node)) quote = true;
        }
        setActiveFormats({
          bold: sel.hasFormat("bold"),
          italic: sel.hasFormat("italic"),
          strikethrough: sel.hasFormat("strikethrough"),
          code: sel.hasFormat("code"),
          numbered: listType === "number",
          bulleted: listType === "bullet" || listType === "check",
          quote,
        });
      });
    };

    const unregister = editor.registerUpdateListener(update);
    update();
    return unregister;
  }, [editorRef]);

  const applyFormat = useCallback(
    (formatId: string) => {
      const editor = editorRef?.current;
      if (!editor) return;

      // dispatchCommand must be called OUTSIDE editor.update() — wrapping it
      // inside update() causes the command to be swallowed in newer Lexical.
      if (formatId === "bold" || formatId === "italic" || formatId === "strikethrough" || formatId === "code") {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, formatId as TextFormatType);
      } else if (formatId === "numbered") {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      } else if (formatId === "bulleted") {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      } else if (formatId === "quote") {
        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "quote" as ElementFormatType);
      }

      // Re-focus so the selection / formatting is preserved
      setTimeout(() => {
        if (editorRef.current) editorRef.current.focus();
      }, 0);
    },
    [editorRef]
  );

  const isCoarse =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  // Mobile: ⋮ toggles between the clipboard group and the format group —
  // WhatsApp's context menu does the same via its overflow.
  const [showFormats, setShowFormats] = useState(false);

  const applyClipboard = useCallback(
    async (id: string) => {
      const editor = editorRef?.current;
      if (id === "copy" || id === "cut") {
        const text =
          editor?.getEditorState().read(() => {
            const sel = $getSelection();
            return $isRangeSelection(sel) ? sel.getTextContent() : "";
          }) ?? "";
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          document.execCommand("copy");
        }
        if (id === "cut") {
          editor?.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) sel.removeText();
          });
          editor?.focus();
        }
        return;
      }
      if (id === "selectAll") {
        if (!editor) return;
        editor.update(() => {
          const root = $getRoot();
          root.select(0, root.getChildrenSize());
        });
        editor.focus();
        return;
      }
      if (id === "paste") {
        try {
          const text = await navigator.clipboard.readText();
          if (!text || !editor) return;
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) sel.insertText(text);
          });
          editor.focus();
        } catch {
          /* clipboard permission denied — native menu paste still works */
        }
      }
    },
    [editorRef]
  );

  // Keep the centered pill inside the viewport — on mobile the selection can
  // sit near a screen edge, which would push half the toolbar off-screen.
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const clampedLeft = Math.min(
    Math.max(position?.left || 0, TOOLBAR_HALF_WIDTH + VIEWPORT_GUTTER),
    Math.max(TOOLBAR_HALF_WIDTH + VIEWPORT_GUTTER, vw - TOOLBAR_HALF_WIDTH - VIEWPORT_GUTTER)
  );
  const clampedTop = Math.max(position?.top || 0, VIEWPORT_GUTTER);

  return (
    <Box
      className="formatting-toolbar"
      sx={{
        position: "fixed !important",
        top: `${clampedTop}px !important`,
        left: `${clampedLeft}px !important`,
        transform: "translateX(-50%) !important",
        zIndex: "9999 !important",
        display: "flex !important",
        alignItems: "center !important",
        gap: "6px !important",
        padding: "8px 12px !important",
        background: "#ffffff !important",
        borderRadius: "24px !important",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.08) !important",
        width: "fit-content !important",
        maxWidth: "calc(100vw - 16px) !important",
        overflowX: "auto !important",
        margin: "0 !important",
        userSelect: "none !important",
        WebkitUserSelect: "none !important",
      }}
    >
      {isCoarse ? (
        <>
          {!showFormats &&
            MOBILE_CLIPBOARD.map((id) => (
              <Box
                key={id}
                component="span"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyClipboard(id);
                }}
                sx={menuItemSx}
              >
                {CLIPBOARD_LABELS[id]}
              </Box>
            ))}
          {showFormats &&
            MOBILE_FORMAT.map((id) => {
              const Icon = FORMAT_ICONS[id];
              const isActive = !!activeFormats[id];
              return (
                <IconButton
                  key={id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyFormat(id);
                  }}
                  size="small"
                  sx={{
                    width: "36px !important",
                    height: "36px !important",
                    borderRadius: "8px !important",
                    color: isActive ? "#ffffff !important" : "#4a4a4a !important",
                    background: isActive ? "#7367f0 !important" : "transparent !important",
                    padding: "0 !important",
                    margin: "0 !important",
                    minWidth: "36px !important",
                    flexShrink: 0,
                    "&:hover": {
                      background: isActive ? "#685dd8 !important" : "#f5f5f5 !important",
                    },
                    "&:active": { transform: "scale(0.95) !important" },
                  }}
                >
                  <Icon size={16} />
                </IconButton>
              );
            })}
          <IconButton
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowFormats((v) => !v);
            }}
            size="small"
            sx={{
              width: "32px !important",
              height: "32px !important",
              borderRadius: "8px !important",
              color: "#4a4a4a !important",
              padding: "0 !important",
              minWidth: "32px !important",
              flexShrink: 0,
              "&:hover": { background: "#f5f5f5 !important" },
              "&:active": { transform: "scale(0.95) !important" },
            }}
          >
            <MoreVertical size={16} />
          </IconButton>
        </>
      ) : (
      FORMAT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = !!activeFormats[option.id];
        return (
          <Tooltip
            key={option.id}
            title={`${option.label} (${option.shortcut})`}
            placement="top"
            arrow
          >
            <IconButton
              // pointerdown covers mouse AND touch — preventDefault keeps the
              // editor selection alive when the chip is tapped on mobile.
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                // Prevent the editor from losing selection when clicking toolbar
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyFormat(option.id);
              }}
              size="small"
              sx={{
                width: "36px !important",
                height: "36px !important",
                borderRadius: "8px !important",
                color: isActive ? "#ffffff !important" : "#4a4a4a !important",
                background: isActive ? "#7367f0 !important" : "transparent !important",
                transition: "all 0.2s ease-in-out !important",
                padding: "0 !important",
                margin: "0 !important",
                minWidth: "36px !important",
                flexShrink: 0,
                "&:hover": {
                  background: isActive ? "#685dd8 !important" : "#f5f5f5 !important",
                  color: isActive ? "#ffffff !important" : "#1a1a1a !important",
                },
                "&:active": {
                  transform: "scale(0.95) !important",
                },
              }}
            >
              <Icon size={16} />
            </IconButton>
          </Tooltip>
        );
      })
      )}
    </Box>
  );
};

export default memo(FormattingToolbarComponent);
