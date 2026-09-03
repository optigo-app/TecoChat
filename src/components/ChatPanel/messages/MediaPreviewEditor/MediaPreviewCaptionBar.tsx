"use client";

import { alpha, IconButton, Tooltip, useTheme } from "@mui/material";
import { Smile, SendHorizontal } from "lucide-react";
import type { LexicalEditor } from "lexical";
import { LexicalChatEditor } from "../../LexicalChatEditor";
import EmojiPickerPopper from "../../input/EmojiPickerPopper";
import FormattingToolbar from "../../input/FormattingToolbar";

/** The caption composer submit control, kept independent from editor state. */
function MediaPreviewSendButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const theme = useTheme();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Send"
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "none",
        background: theme.palette.primary.main,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.7 : 1,
        flexShrink: 0,
        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
        transition: "all 0.2s ease",
      }}
    >
      <SendHorizontal size={22} />
    </button>
  );
}

interface MediaPreviewCaptionBarProps {
  caption: string;
  isExporting: boolean;
  showCaptionEmoji: boolean;
  showFormattingToolbar: boolean;
  toolbarPosition: { top: number; left: number };
  isDark: boolean;
  borderColor: string;
  titleColor: string;
  subtitleColor: string;
  syncKey?: string | number;
  editorRef: React.RefObject<LexicalEditor | null>;
  captionEmojiBtnRef: React.RefObject<HTMLButtonElement | null>;
  editorWrapperRef: React.RefObject<HTMLDivElement | null>;
  onEditorChange: (val: string) => void;
  onKeyDown: () => void;
  onSend: () => void;
  onToggleCaptionEmoji: () => void;
  onCaptionEmojiClick: (emojiData: { emoji: string }) => void;
  onCloseCaptionEmoji: () => void;
  onSelectionChange: () => void;
}

/** Bottom caption & send bar with emoji picker, formatting toolbar, and Lexical editor. */
export default function MediaPreviewCaptionBar({
  caption,
  isExporting,
  showCaptionEmoji,
  showFormattingToolbar,
  toolbarPosition,
  isDark,
  borderColor,
  titleColor,
  subtitleColor,
  syncKey,
  editorRef,
  captionEmojiBtnRef,
  editorWrapperRef,
  onEditorChange,
  onKeyDown,
  onSend,
  onToggleCaptionEmoji,
  onCaptionEmojiClick,
  onCloseCaptionEmoji,
  onSelectionChange,
}: MediaPreviewCaptionBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 12,
        padding: "10px 16px",
        background: isDark ? "rgba(20,20,30,0.98)" : "#ffffff",
        borderTop: `1px solid ${borderColor}`,
        paddingBottom: "max(12px, var(--safe-bottom))",
        flexShrink: 0,
      }}
    >
      <div
        className="media-caption-editor"
        ref={editorWrapperRef}
        onMouseUp={onSelectionChange}
        onKeyUp={onSelectionChange}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(245,245,245,0.95)",
          borderRadius: 20,
          padding: "6px 12px",
          gap: 4,
          border: `1px solid ${borderColor}`,
          minHeight: 44,
          position: "relative",
        }}
      >
        <Tooltip title="Emoji" arrow>
          <span style={{ display: "inline-flex", flexShrink: 0 }}>
            <IconButton
              ref={captionEmojiBtnRef}
              size="small"
              onClick={onToggleCaptionEmoji}
              sx={{
                color: subtitleColor,
                width: 32,
                height: 32,
                "&:hover": { color: titleColor },
              }}
            >
              <Smile size={18} />
            </IconButton>
          </span>
        </Tooltip>

        <EmojiPickerPopper
          open={showCaptionEmoji}
          anchorEl={captionEmojiBtnRef.current}
          onEmojiClick={onCaptionEmojiClick}
          onClose={onCloseCaptionEmoji}
          darkMode={isDark}
        />

        {showFormattingToolbar && (
          <FormattingToolbar editorRef={editorRef} position={toolbarPosition} />
        )}

        <LexicalChatEditor
          value={caption}
          onChange={onEditorChange}
          onKeyDown={onKeyDown}
          placeholder="Add a caption..."
          editorRef={editorRef}
          syncKey={syncKey}
          namespace="MediaCaptionEditor"
          submitOnEnter={true}
          hasDraft={caption.trim().length > 0}
        />
      </div>

      <MediaPreviewSendButton disabled={isExporting} onClick={onSend} />
    </div>
  );
}
