"use client";

import { memo, useRef, useState, useCallback, useEffect } from "react";
import { IconButton, Tooltip, Box, Typography, useTheme, alpha } from "@mui/material";
import { Paperclip, Smile, SendHorizontal, X } from "lucide-react";
import { renderMessageText } from "../../utils/messageTextRenderer";
import { normalizeMessageText, getSoftAvatarColors } from "../../utils/globalFunc";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  CLEAR_EDITOR_COMMAND,
  $getSelection,
  $isRangeSelection,
  $getRoot,
  $createParagraphNode,
  type LexicalEditor,
} from "lexical";
import { LexicalChatEditor } from "./LexicalChatEditor";
import EmojiPickerPopper from "./input/EmojiPickerPopper";
import AttachmentMenu from "./input/AttachmentMenu";
import FormattingToolbar from "./input/FormattingToolbar";
import ConfirmationDialog from "./input/ConfirmationDialog";
import type { ReplyToMessage, MediaFileItem } from "./CoreLogic/uiReducer";
import type { MentionData } from "./input/MentionPlugin";
import type { MentionMember } from "./input/MentionDropdown";

interface ChatInputProps {
  onSend: (text: string, mentions?: MentionData[]) => void;
  disabled?: boolean;
  placeholder?: string;
  syncKey?: string | number;
  replyToMessage?: ReplyToMessage | null;
  onCancelReply?: () => void;
  mediaFiles?: MediaFileItem[];
  onAttachClick?: () => void;
  showMedia?: boolean;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onProcessFiles?: (files: File[]) => void;
  onRemoveMedia?: (index: number) => void;
  onClearMedia?: () => void;
  darkMode?: boolean;
  isRemovedFromGroup?: boolean;
  isOnlyAdminSend?: boolean;
  isCurrentUserAdmin?: boolean;
  onTypingChange?: (hasContent: boolean) => void;
  mentionMembers?: MentionMember[];
  excludeUserId?: string | number;
  onFetchMembers?: () => void;
  isGroup?: boolean;
  /** Draft text restored from localStorage when switching conversations */
  inputValue?: string;
  /** Called on every text change so the draft ref in useConversation stays in sync */
  onInputChange?: (val: string) => void;
  isOffline?: boolean;
}

const MAX_CHARS = 2000;
const WARNING_THRESHOLD = 1000;

const ChatInputComponent: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  syncKey,
  replyToMessage,
  onCancelReply,
  mediaFiles = [],
  onAttachClick,
  showMedia = false,
  onFileChange,
  onProcessFiles,
  onRemoveMedia,
  onClearMedia,
  darkMode = false,
  isRemovedFromGroup = false,
  isOnlyAdminSend = false,
  isCurrentUserAdmin = false,
  onTypingChange,
  mentionMembers = [],
  excludeUserId,
  onFetchMembers,
  isGroup = false,
  inputValue,
  onInputChange,
  isOffline = false,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  // textRef holds the current editor text without triggering re-renders.
  // We only update React state when the "canSend" boolean or charCount bucket
  // changes, so typing doesn't re-render the entire ChatInput component tree.
  const textRef = useRef("");
  const [canSend, setCanSend] = useState(false);
  const [charBucket, setCharBucket] = useState(0); // rounded to nearest 10
  const [mentions, setMentions] = useState<MentionData[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [pendingPasteText, setPendingPasteText] = useState("");
  const [pendingPasteFileName, setPendingPasteFileName] = useState("");
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const editorRef = useRef<LexicalEditor | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);

  const charCount = charBucket;
  const isNearLimit = charCount >= WARNING_THRESHOLD;
  const isAtLimit = charCount >= MAX_CHARS;
  const showOnlyAdminNotice = isOnlyAdminSend && !isCurrentUserAdmin;
  const inputHidden = isRemovedFromGroup || showOnlyAdminNotice;

  // Typing indicator emit — called on every text change (debounced by Lexical's rAF)
  const handleEditorChange = useCallback(
    (val: string) => {
      textRef.current = val;
      // Keep draft ref in sync so drafts are saved on conversation switch
      onInputChange?.(val);
      if (onTypingChange) onTypingChange(val.trim().length > 0);

      // Only update React state if the "canSend" boolean or char bucket changed.
      // This avoids re-rendering the entire ChatInput tree on every keystroke.
      const trimmed = val.trim();
      const nextCanSend = (trimmed.length > 0 || mediaFiles.length > 0) && !disabled && !inputHidden;
      setCanSend((prev) => (prev !== nextCanSend ? nextCanSend : prev));

      const len = val.length;
      const bucket = Math.round(len / 10) * 10;
      setCharBucket((prev) => (prev !== bucket ? bucket : prev));
    },
    [onTypingChange, onInputChange, mediaFiles.length, disabled, inputHidden]
  );

  // ── Draft restore: sync local text when inputValue changes externally ──────
  // This fires when useConversation loads a draft from localStorage on
  // conversation switch. We also re-sync on syncKey (conversationId) change
  // to catch the case where inputValue hasn't updated yet but the conversation
  // has changed — matches old code's ChatBox.js pattern.
  useEffect(() => {
    if (inputValue != null && inputValue !== textRef.current) {
      textRef.current = inputValue;
      // Update canSend/charBucket for the restored draft
      const trimmed = inputValue.trim();
      const nextCanSend = (trimmed.length > 0 || mediaFiles.length > 0) && !disabled && !inputHidden;
      setCanSend(nextCanSend);
      setCharBucket(Math.round(inputValue.length / 10) * 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, syncKey]);

  // Focus editor when reply is set
  useEffect(() => {
    if (replyToMessage && editorRef.current && !inputHidden) {
      editorRef.current.focus();
    }
  }, [replyToMessage, inputHidden]);

  // Focus editor on conversation change (deferred to avoid forced reflow)
  useEffect(() => {
    if (syncKey && editorRef.current && !inputHidden) {
      const id = requestAnimationFrame(() => editorRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [syncKey, inputHidden]);

  // Clear Lexical editor when inputValue becomes empty (draft cleared / conv switch)
  // Matches old code's ChatBox.js pattern — ensures editor is visually empty.
  useEffect(() => {
    if (!inputValue && editorRef.current) {
      editorRef.current.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    const text = textRef.current;
    if (!((text.trim().length > 0 || mediaFiles.length > 0) && !disabled && !inputHidden)) return;
    onSend(text.trim(), mentions.length > 0 ? mentions : undefined);
    textRef.current = "";
    setMentions([]);
    setCanSend(false);
    setCharBucket(0);
    // Clear draft ref so the empty input is saved as "no draft"
    onInputChange?.("");
    if (editorRef.current) {
      editorRef.current.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
    }
  }, [onSend, mentions, onInputChange, mediaFiles.length, disabled, inputHidden]);

  const handleKeyDown = useCallback(() => {
    handleSend();
  }, [handleSend]);

  // ── Paste overflow: convert to .txt file ────────────────────────────────────
  const handlePasteOverflow = useCallback((overflowText: string) => {
    setPendingPasteText(overflowText);
    setPendingPasteFileName(`pasted-content-${Date.now()}.txt`);
    setPasteDialogOpen(true);
  }, []);

  const handleConfirmFileConversion = useCallback(
    (fileName: string) => {
      let finalName = fileName.trim();
      if (!finalName.toLowerCase().endsWith(".txt")) {
        finalName = finalName + ".txt";
      }
      const content = pendingPasteText.trim();
      const file = new File([content], finalName, { type: "text/plain" });
      if (onProcessFiles) onProcessFiles([file]);

      // Clear leaked text from editor
      if (editorRef.current) {
        editorRef.current.update(() => {
          const root = $getRoot();
          root.clear();
          root.append($createParagraphNode());
        });
        editorRef.current.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
      }

      setPasteDialogOpen(false);
      setPendingPasteText("");
      setPendingPasteFileName("");
    },
    [pendingPasteText, onProcessFiles]
  );

  const handleCancelFileConversion = useCallback(() => {
    setPasteDialogOpen(false);
    setPendingPasteText("");
    setPendingPasteFileName("");
    if (editorRef.current) {
      editorRef.current.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
    }
  }, []);

  const handlePasteFiles = useCallback(
    (files: File[]) => {
      if (onProcessFiles) onProcessFiles(files);
    },
    [onProcessFiles]
  );

  // ── Emoji insertion ──────────────────────────────────────────────────────────
  // The emoji button uses onMouseDown preventDefault to keep the editor
  // focused, so the cursor position is always current when the picker opens.

  const onEmojiClick = useCallback(
    (emojiData: { emoji: string }) => {
      const emoji = emojiData?.emoji || "";
      if (editorRef.current) {
        editorRef.current.update(() => {
          const root = $getRoot();
          if (!root.getLastChild()) root.append($createParagraphNode());
          root.selectEnd();
          const selection = $getSelection();
          if ($isRangeSelection(selection)) selection.insertText(emoji);
        });
        editorRef.current.focus();
      } else {
        textRef.current = textRef.current + emoji;
      }
      setShowEmoji(false);
    },
    []
  );

  // ── Formatting toolbar ──────────────────────────────────────────────────────
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setShowFormattingToolbar(false);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!range) return;

    // Ensure the selection is within the lexical editor (matches old code)
    const editorContainer = document.querySelector(".lexical-editor-container");
    if (!editorContainer || !editorContainer.contains(range.startContainer)) {
      setShowFormattingToolbar(false);
      return;
    }

    const rect = range.getBoundingClientRect();
    setToolbarPosition({
      top: rect.top - 50,
      left: rect.left + rect.width / 2,
    });
    setShowFormattingToolbar(true);
  }, []);

  // ── Close formatting toolbar on outside click ──────────────────────────────
  useEffect(() => {
    if (!showFormattingToolbar) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the toolbar itself
      const toolbar = document.querySelector(".formatting-toolbar");
      if (toolbar && toolbar.contains(target)) return;
      // Don't close if clicking inside the editor (selection change handles that)
      const editorContainer = document.querySelector(".lexical-editor-container");
      if (editorContainer && editorContainer.contains(target)) return;
      setShowFormattingToolbar(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showFormattingToolbar]);

  // ── Attachment menu ──────────────────────────────────────────────────────────
  const handleAttachClick = useCallback(() => {
    if (onAttachClick) {
      onAttachClick();
    } else {
      setShowAttach((v) => !v);
    }
  }, [onAttachClick]);

  const attachMenuOpen = onAttachClick ? showMedia : showAttach;

  const handleAttachMenuClose = useCallback(() => {
    if (onAttachClick) {
      onAttachClick();
    } else {
      setShowAttach(false);
    }
  }, [onAttachClick]);

  const openFilePicker = useCallback(
    (_e: React.MouseEvent, params: { accept: string; type: string }) => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = params.accept;
        fileInputRef.current.click();
      }
    },
    []
  );

  const handleFileChangeInternal = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onFileChange) {
        onFileChange(e);
      }
      setShowAttach(false);
    },
    [onFileChange]
  );

  // ── Group restriction notice ────────────────────────────────────────────────
  if (inputHidden) {
    const noticeText = isRemovedFromGroup
      ? "You can no longer send messages to this group because you've been removed."
      : "Only group admins can send messages in this group.";
    return (
      <div className="chat-input-area">
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 16px",
            paddingBottom: "calc(14px + var(--safe-bottom))",
            color: theme.palette.text.secondary,
            fontSize: "0.85rem",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {noticeText}
        </Box>
      </div>
    );
  }

  return (
    <div className="chat-input-area">
      {/* Reply preview composer bar (ported from ReplyToComponents/ReplyPreview.jsx) */}
      {replyToMessage && (
        <Box
          className="reply-preview-container"
          sx={{
            px: 2,
            py: 1.1,
            mb: 1,
            backgroundColor: alpha(theme.palette.background.paper, 0.92),
            backdropFilter: "blur(10px)",
            border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
            borderRadius: 2,
            animation: "slideDown 0.2s ease-out",
            overflow: "hidden",
            maxHeight: "80px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              maxWidth: "100%",
            }}
          >
            {/* Left gradient bar */}
            <Box
              sx={{
                width: 4,
                height: 34,
                background: (theme.palette.primary as any).gradient || theme.palette.primary.main,
                borderRadius: 1,
                flexShrink: 0,
              }}
            />

            {/* Sender + text */}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  lineHeight: 1.2,
                }}
              >
                Replying to{" "}
                <Box component="span" sx={{ fontWeight: 600, color: replyToMessage.sender === "You" ? theme.palette.text.primary : (theme.palette.mode === "dark" ? getSoftAvatarColors(String(replyToMessage.sender || "unknown")).fgDark : getSoftAvatarColors(String(replyToMessage.sender || "unknown")).fg) }}>
                  {replyToMessage.sender}
                </Box>
              </Typography>
              <Typography
                variant="caption"
                component="div"
                sx={{
                  color: alpha(theme.palette.text.primary, 0.72),
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  lineHeight: 1.3,
                  maxHeight: "2.6em",
                }}
              >
                {normalizeMessageText(replyToMessage.text || "")
                  ? renderMessageText(normalizeMessageText(replyToMessage.text))
                  : " "}
              </Typography>
            </Box>

            {/* Media thumbnail */}
            {(replyToMessage as any).mediaUrl && (
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  overflow: "hidden",
                  flexShrink: 0,
                  backgroundColor: alpha(theme.palette.text.primary, 0.05),
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                  position: "relative",
                  ml: 1,
                }}
              >
                {(replyToMessage as any).MessageType === "video" ? (
                  <video
                    src={(replyToMessage as any).mediaUrl}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <img
                    src={(replyToMessage as any).mediaUrl}
                    alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </Box>
            )}

            {/* Cancel button */}
            {onCancelReply && (
              <IconButton
                size="small"
                onClick={onCancelReply}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  color: alpha(theme.palette.text.primary, 0.7),
                  backgroundColor: alpha(theme.palette.text.primary, 0.04),
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.text.primary, 0.08),
                    color: theme.palette.text.primary,
                  },
                }}
              >
                <X size={18} strokeWidth={2.2} />
              </IconButton>
            )}
          </Box>
        </Box>
      )}

      {/* Media preview thumbnails */}
      {mediaFiles.length > 0 && (
        <Box
          sx={{
            display: "flex",
            gap: 1,
            padding: "8px 12px",
            overflowX: "auto",
            flexWrap: "nowrap",
          }}
        >
          {mediaFiles.map((media, idx) => (
            <Box
              key={idx}
              sx={{
                position: "relative",
                width: 64,
                height: 64,
                borderRadius: 1,
                overflow: "hidden",
                flexShrink: 0,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {media.type === "image" ? (
                <img src={media.preview} alt={media.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : media.type === "video" ? (
                <video src={media.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
              ) : (
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.palette.action.hover,
                    fontSize: 9,
                    textAlign: "center",
                    p: 0.5,
                    wordBreak: "break-all",
                  }}
                >
                  {media.name}
                </Box>
              )}
              {onRemoveMedia && (
                <IconButton
                  size="small"
                  onClick={() => onRemoveMedia(idx)}
                  sx={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    color: "#fff",
                    width: 20,
                    height: 20,
                    "&:hover": { backgroundColor: "rgba(0,0,0,0.7)" },
                  }}
                >
                  <X size={12} />
                </IconButton>
              )}
            </Box>
          ))}
          {onClearMedia && (
            <Box
              onClick={onClearMedia}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: theme.palette.text.secondary,
                fontSize: 12,
                padding: "0 8px",
                whiteSpace: "nowrap",
                "&:hover": { color: theme.palette.error.main },
              }}
            >
              Clear all
            </Box>
          )}
        </Box>
      )}

      <div className="chat-input-container">
        {/* Attachment button */}
        <Tooltip title="Attach" arrow>
          <span>
            <IconButton
              ref={attachButtonRef}
              size="small"
              className="chat-input-btn"
              onClick={handleAttachClick}
              disabled={disabled}
            >
              <Paperclip size={isMobile ? 18 : 20} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Emoji button */}
        <Tooltip title="Emoji" arrow>
          <span>
            <IconButton
              ref={emojiButtonRef}
              size="small"
              className="chat-input-btn"
              onMouseDown={(e) => {
                // Prevent the editor from losing focus when the emoji button
                // is pressed. This keeps the cursor position intact so emoji
                // insertion happens at the right spot.
                e.preventDefault();
              }}
              onClick={() => setShowEmoji((v) => !v)}
              disabled={disabled}
            >
              <Smile size={isMobile ? 18 : 20} />
            </IconButton>
          </span>
        </Tooltip>

        <EmojiPickerPopper
          open={showEmoji}
          anchorEl={emojiButtonRef.current}
          onEmojiClick={onEmojiClick}
          onClose={() => setShowEmoji(false)}
          darkMode={darkMode}
        />

        <AttachmentMenu
          anchorEl={attachButtonRef.current}
          open={Boolean(attachButtonRef.current) && attachMenuOpen}
          onClose={handleAttachMenuClose}
          onFilePick={(e, params) => {
            handleAttachMenuClose();
            openFilePicker(e, params);
          }}
        />

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChangeInternal}
          multiple
        />

        {/* Lexical rich text editor with formatting toolbar */}
        <div
          className="chat-input-editor-wrapper"
          ref={editorWrapperRef}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
        >
          {showFormattingToolbar && (
            <FormattingToolbar
              editorRef={editorRef}
              position={toolbarPosition}
            />
          )}
          <LexicalChatEditor
            value={inputValue ?? textRef.current}
            onChange={handleEditorChange}
            onKeyDown={handleKeyDown}
            placeholder={isOffline ? "Offline — type and send, we'll deliver when you reconnect" : (mediaFiles.length > 0 ? "Type a caption..." : placeholder)}
            editorRef={editorRef}
            syncKey={syncKey}
            maxChars={MAX_CHARS}
            onPasteTextOverflow={handlePasteOverflow}
            onPasteFiles={handlePasteFiles}
            hasDraft={(textRef.current || inputValue || "").trim().length > 0}
            mentionMembers={mentionMembers}
            onMentionsChange={setMentions}
            excludeUserId={excludeUserId}
            onFetchMembers={onFetchMembers}
            isGroup={isGroup}
          />
        </div>

        {/* Character count */}
        {charCount > 0 && (
          <Typography
            variant="caption"
            className={`chat-input-count ${isNearLimit ? "warning" : ""}`}
            sx={{
              position: "absolute",
              bottom: -20,
              right: 50,
              fontSize: 11,
              color: isAtLimit
                ? theme.palette.error.main
                : isNearLimit
                ? theme.palette.warning.main
                : theme.palette.text.secondary,
              fontWeight: isAtLimit ? 600 : 400,
            }}
          >
            {charCount}/{MAX_CHARS}
          </Typography>
        )}

        {/* Send button */}
        <Tooltip
          title={isOffline ? "You're offline — message will be sent when you reconnect" : ""}
          arrow
          disableHoverListener={!isOffline}
        >
          <span>
            <IconButton
              size="small"
              className={`chat-input-send ${canSend ? "active" : ""} ${isOffline ? "offline" : ""}`}
              onClick={handleSend}
              disabled={!canSend}
            >
              <SendHorizontal size={isMobile ? 18 : 20} />
            </IconButton>
          </span>
        </Tooltip>
      </div>

      {/* Paste-to-TXT conversion dialog */}
      <ConfirmationDialog
        open={pasteDialogOpen}
        title="Convert to File"
        description="The pasted text exceeds the character limit. It will be converted to a .txt file attachment. Enter a filename:"
        defaultFileName={pendingPasteFileName}
        confirmLabel="Convert"
        cancelLabel="Cancel"
        onConfirm={handleConfirmFileConversion}
        onCancel={handleCancelFileConversion}
      />
    </div>
  );
};

export const ChatInput = memo(ChatInputComponent);
export default ChatInput;
