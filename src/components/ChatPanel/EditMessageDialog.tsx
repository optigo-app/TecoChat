"use client";

// Ported from OldChatReactCode/src/components/Conversation/EditMessageDialog.jsx
// Modal dialog for editing a sent message. Uses LexicalChatEditor for rich text
// editing with emoji picker and formatting toolbar support.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { X, Smile } from "lucide-react";
import { LexicalChatEditor } from "./LexicalChatEditor";
import FormattingToolbar from "./input/FormattingToolbar";
import EmojiPickerPopper from "./input/EmojiPickerPopper";
import { normalizeMessageText } from "../../utils/globalFunc";
import { renderMessageText, type MentionInfo } from "../../utils/messageTextRenderer";
import {
  $getSelection,
  $isRangeSelection,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isTextNode,
  type TextNode,
  type ElementNode,
  type LexicalNode,
  type LexicalEditor,
} from "lexical";
import { $createMentionNode } from "./input/MentionNode";
import type { ChatMessage } from "../../types/message";
import type { MentionMember } from "./input/MentionDropdown";
import type { MentionData } from "./input/MentionPlugin";

interface EditMessageDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (messageId: string | number, newMessage: string, mentions?: MentionData[]) => void;
  originalMessage: ChatMessage | null;
  isGroup?: boolean;
  mentionMembers?: MentionMember[];
  excludeUserId?: string | number;
  onFetchMembers?: () => void;
}

// Convert @mention text in the editor to MentionNode chips based on
// the original message's MentionUsers metadata. This runs once after the
// editor loads the text so existing mentions are shown as chips.
function convertExistingMentions(
  editor: LexicalEditor,
  mentions: MentionInfo[]
) {
  if (!mentions.length) return;

  // Sort longest-first so we match longer mention texts before shorter ones
  const sorted = [...mentions]
    .filter((m) => m.MentionText)
    .sort((a, b) => b.MentionText.length - a.MentionText.length);
  const escaped = sorted.map((m) =>
    m.MentionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "g");

  editor.update(() => {
    const root = $getRoot();
    root.getChildren().forEach((paragraph) => {
      if (!("getChildren" in paragraph)) return;
      const children = (paragraph as ElementNode).getChildren();
      const newNodes: LexicalNode[] = [];

      for (const child of children) {
        if (!$isTextNode(child)) {
          newNodes.push(child);
          continue;
        }
        const text = child.getTextContent();
        regex.lastIndex = 0;
        if (!regex.test(text)) {
          newNodes.push(child);
          continue;
        }
        regex.lastIndex = 0;

        // Split text by mention matches and create MentionNodes
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            newNodes.push($createTextNode(text.slice(lastIndex, match.index)));
          }
          const mentionText = match[0];
          const mention = sorted.find((m) => m.MentionText === mentionText);
          if (mention) {
            const isAll = mention.MentionType === 2 || String(mention.MentionedUserId) === "";
            newNodes.push(
              $createMentionNode({
                userId: isAll ? "all" : mention.MentionedUserId,
                userName: mentionText.replace(/^@/, ""),
                mentionText,
              })
            );
          } else {
            newNodes.push($createTextNode(mentionText));
          }
          lastIndex = match.index + mentionText.length;
        }
        if (lastIndex < text.length) {
          newNodes.push($createTextNode(text.slice(lastIndex)));
        }
      }

      // Replace all children with newNodes
      (paragraph as ElementNode).clear();
      newNodes.forEach((n) => (paragraph as ElementNode).append(n));
    });
  });
}

const EditMessageDialog = ({
  open,
  onClose,
  onSave,
  originalMessage,
  isGroup = false,
  mentionMembers = [],
  excludeUserId,
  onFetchMembers,
}: EditMessageDialogProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isLarge = useMediaQuery(theme.breakpoints.up("lg"));
  const dialogMaxWidth = isLarge ? "lg" : "md";

  const [editText, setEditText] = useState("");
  const [mentions, setMentions] = useState<MentionData[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const editEditorRef = useRef<any>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const normalizedOriginal = useMemo(
    () => normalizeMessageText(originalMessage?.Message || "").trim(),
    [originalMessage?.Message]
  );

  // Parse existing mentions from the original message's MentionUsers JSON
  const existingMentions = useMemo<MentionInfo[]>(() => {
    const raw = (originalMessage as any)?.MentionUsers || (originalMessage as any)?.Mentions;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [originalMessage]);

  useEffect(() => {
    if (open) {
      setEditText(normalizedOriginal);
      setMentions(
        existingMentions.map((m) => ({
          userId: m.MentionedUserId || "all",
          userName: m.MentionText.replace(/^@/, ""),
          mentionText: m.MentionText,
        }))
      );
      setShowEmojiPicker(false);
      setShowFormattingToolbar(false);
      const timer = setTimeout(() => {
        editEditorRef.current?.focus();
        // After the editor loads the text, convert @mention text to chips
        if (existingMentions.length > 0 && editEditorRef.current) {
          convertExistingMentions(editEditorRef.current, existingMentions);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, normalizedOriginal, existingMentions]);

  const handleLexicalChange = useCallback((markdown: string) => {
    setEditText(markdown);
  }, []);

  const handleSave = useCallback(() => {
    const trimmedText = editText.trim();
    if (trimmedText && trimmedText !== normalizedOriginal) {
      const msg = originalMessage as any;
      onSave(msg.MessageId || msg.Id, trimmedText, mentions.length > 0 ? mentions : undefined);
    }
    onClose();
  }, [editText, normalizedOriginal, originalMessage, onSave, onClose, mentions]);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    const hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed;
    if (hasSelection && editorWrapperRef.current) {
      const range = selection!.getRangeAt(0);
      if (editorWrapperRef.current.contains(range.startContainer)) {
        const rect = range.getBoundingClientRect();
        setToolbarPosition({
          top: rect.top - 50,
          left: rect.left + rect.width / 2,
        });
        setShowFormattingToolbar(true);
        return;
      }
    }
    setShowFormattingToolbar(false);
  }, []);

  const handleEmojiClick = useCallback((emojiData: any) => {
    const emoji = emojiData?.emoji || "";
    if (editEditorRef.current) {
      editEditorRef.current.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(emoji);
        } else {
          const root = $getRoot();
          let p = root.getLastChild() as any;
          if (!p) {
            p = $createParagraphNode();
            root.append(p);
          }
          (p as any).append($createTextNode(emoji));
        }
      });
      editEditorRef.current.focus();
    }
    setShowEmojiPicker(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent | null) => {
      if (event && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={isMobile}
      maxWidth={dialogMaxWidth as any}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
          },
        },
        paper: {
          sx: { borderRadius: "16px", p: 1 },
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: 600,
        }}
      >
        Edit Message
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 2,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          alignItems: "stretch",
        }}
      >
        {/* Original message preview */}
        <Box
          sx={{
            width: { xs: "100%", md: "35%" },
            flexShrink: 0,
            p: 2,
            backgroundColor: "var(--color-hover-bg)",
            borderRadius: "12px",
            maxHeight: { xs: "120px", md: "55vh" },
            overflowY: "auto",
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "var(--color-primary)", fontWeight: 600, display: "block", mb: 0.5 }}
          >
            Original Message
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography
              variant="body2"
              component="div"
              sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}
            >
              {renderMessageText(normalizedOriginal, (originalMessage as any)?.MentionUsers)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
            >
              {(originalMessage as any)?.Time}
            </Typography>
          </Box>
        </Box>

        {/* Editor area */}
        <Box sx={{ flex: 1, position: "relative", minWidth: 0 }}>
          {showFormattingToolbar && (
            <FormattingToolbar editorRef={editEditorRef} position={toolbarPosition} />
          )}

          <Box
            ref={editorWrapperRef}
            onMouseUp={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            sx={{
              position: "relative",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "12px",
              backgroundColor: "transparent",
              maxHeight: { xs: "50vh", md: "55vh" },
              overflowY: "auto",
              p: 1,
              pb: 5,
              "& .lexical-editor-container": {
                maxHeight: "none",
                overflowY: "visible",
              },
            }}
          >
            <LexicalChatEditor
              value={normalizedOriginal}
              syncKey={open ? `${(originalMessage as any)?.Id}-${normalizedOriginal.length}` : "closed"}
              onChange={handleLexicalChange}
              onKeyDown={handleKeyDown}
              namespace="WhatsAppEditMessageEditor"
              submitOnEnter={false}
              placeholder="Edit your message..."
              editorRef={editEditorRef}
              isGroup={isGroup}
              mentionMembers={mentionMembers}
              onMentionsChange={setMentions}
              excludeUserId={excludeUserId}
              onFetchMembers={onFetchMembers}
            />
            <IconButton
              ref={emojiButtonRef}
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              size="small"
              sx={{
                position: "absolute",
                bottom: 12,
                right: 12,
                zIndex: 1,
                color: "text.secondary",
                bgcolor: "background.paper",
                borderRadius: "50%",
                p: 0.5,
                boxShadow: 1,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Smile size={20} />
            </IconButton>
          </Box>

          <EmojiPickerPopper
            open={showEmojiPicker}
            anchorEl={emojiButtonRef.current}
            onEmojiClick={handleEmojiClick}
            onClose={() => setShowEmojiPicker(false)}
            darkMode={theme.palette.mode === "dark"}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} className="secondaryBtnClassname">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!editText.trim() || editText.trim() === normalizedOriginal}
          className="primaryBtnClassname"
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditMessageDialog;
