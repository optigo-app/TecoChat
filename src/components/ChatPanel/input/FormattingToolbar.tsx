"use client";

import { memo, useCallback } from "react";
import { Box, Tooltip, IconButton } from "@mui/material";
import { Bold, Italic, Strikethrough, Code, ListOrdered, List, Quote } from "lucide-react";
import {
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  type TextFormatType,
  type ElementFormatType,
} from "lexical";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
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

const FormattingToolbarComponent = ({ editorRef, position }: FormattingToolbarProps) => {
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

  return (
    <Box
      className="formatting-toolbar"
      sx={{
        position: "fixed !important",
        top: `${position?.top || 0}px !important`,
        left: `${position?.left || 0}px !important`,
        transform: "translateX(-50%) !important",
        zIndex: "9999 !important",
        display: "flex !important",
        alignItems: "center !important",
        gap: "8px !important",
        padding: "8px 16px !important",
        background: "#ffffff !important",
        borderRadius: "24px !important",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.08) !important",
        width: "fit-content !important",
        margin: "0 !important",
      }}
    >
      {FORMAT_OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <Tooltip
            key={option.id}
            title={`${option.label} (${option.shortcut})`}
            placement="top"
            arrow
          >
            <IconButton
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
                width: "32px !important",
                height: "32px !important",
                borderRadius: "8px !important",
                color: "#4a4a4a !important",
                transition: "all 0.2s ease-in-out !important",
                padding: "0 !important",
                margin: "0 !important",
                minWidth: "32px !important",
                "&:hover": {
                  background: "#f5f5f5 !important",
                  color: "#1a1a1a !important",
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
      })}
    </Box>
  );
};

export default memo(FormattingToolbarComponent);
