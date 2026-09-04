"use client";

import { memo, useState, useMemo } from "react";
import { Box, Typography, IconButton, Avatar, Tooltip, useTheme, alpha } from "@mui/material";
import { CheckCheck, CircleMinus, ChevronDown, Forward, Clock, Star, RotateCcw } from "lucide-react";
import { Emoji, EmojiStyle } from "emoji-picker-react";
import type { ChatMessage } from "../../types/message";
import type { ConversationListEntry } from "../../types/conversation";
import { formatDateTime } from "../../utils/dateUtils";
import { normalizeMessageText, getSoftAvatarColors } from "../../utils/globalFunc";
import { renderMessageText } from "../../utils/messageTextRenderer";
import { charToUnified, parseReactions } from "../../utils/EmojiUtils";
import { ReplyPreview, MediaMessage, ReadMoreText } from "./messages/bubble";
import { MessageActions, ReactionDetailsMenu } from "./messages/interactions";

interface MessageBubbleProps {
  msg: ChatMessage;
  isOutgoing: boolean;
  selectedCustomer: ConversationListEntry | null;
  getMessageStatusIcon: (msg: ChatMessage) => "sent" | "delivered" | "read" | null;
  onContextMenu?: (e: React.MouseEvent, msg: ChatMessage) => void;
  onMenuClick?: (e: React.MouseEvent, msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage, event?: React.MouseEvent) => void;
  onQuickReaction?: (emoji: string, msg: ChatMessage) => void;
  onRemoveReaction?: (reaction: { Emoji?: string; Reaction?: string; UserId?: number | string }, msg: ChatMessage) => void;
  onMediaClick?: (msg: ChatMessage, index: number) => void;
  onRetry?: (msg: ChatMessage) => void;

  getMediaKey: (msg: ChatMessage, index: number) => string;
  loadedMedia: Record<string, boolean>;
  markLoaded: (key: string) => void;
  getMediaSrcForMessage: (msg: ChatMessage) => string;
  messageById?: Map<string | number, ChatMessage>;
  scrollToMessage?: (
    messageId: string | number,
    containerRef: React.MutableRefObject<HTMLElement | null>,
    attachmentId?: string | null
  ) => void;
  containerRef?: React.MutableRefObject<HTMLElement | null>;
  shouldShowActions?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  auth?: { id?: string | number; userId?: string | number } | null;
  highlightQuery?: string | null;
}

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  msg,
  isOutgoing,
  selectedCustomer,
  getMessageStatusIcon,
  onContextMenu,
  onMenuClick,
  onForward,
  onQuickReaction,
  onRemoveReaction,
  onMediaClick,
  onRetry,
  getMediaKey,
  loadedMedia,
  markLoaded,
  messageById,
  scrollToMessage,
  containerRef,
  shouldShowActions = false,
  isExpanded = false,
  onToggleExpand,
  auth,
  highlightQuery,
}) => {
  const theme = useTheme();
  const isGroup = (selectedCustomer as { IsGroup?: number }).IsGroup === 1;
  const isDeleted = msg.IsDeletedForEveryone === 1;
  const isReply = msg.ContextType === 2;
  const isForwarded = !!msg.ForwardedFrom && msg.ForwardedFrom !== "0";
  const isMediaMessage = ["image", "video", "document"].includes(msg.MessageType || "");
  const [reactionAnchorEl, setReactionAnchorEl] = useState<HTMLElement | null>(null);

  const parsedReactions = useMemo(
    () => parseReactions(msg.ReactionEmojis),
    [msg.ReactionEmojis]
  );

  const senderName =
    msg.SenderInfo ||
    (msg.FirstName ? `${msg.FirstName} ${msg.LastName || ""}` : msg.Sender) ||
    "Member";

  // WhatsApp-style: each group member gets a consistent color derived from their name
  const senderColor = useMemo(() => {
    const { fg, fgDark } = getSoftAvatarColors(String(senderName || "unknown"));
    return theme.palette.mode === "dark" ? fgDark : fg;
  }, [senderName, theme.palette.mode]);

  const time = msg.Time || msg.dateTime || (msg.DateTime ? formatDateTime(msg.DateTime, "time") : "");
  const statusKey = getMessageStatusIcon(msg);
  const isPending = msg.Status === "pending";
  const isFailed = msg.Status === 4 || msg.Status === "failed";

  const messageText = normalizeMessageText(msg.Message || "").trim();

  const original = isReply && msg.ContextId && messageById
    ? messageById.get(msg.ContextId)
    : null;

  return (
    <Box
      className={`message-bubble-wrapper ${isOutgoing ? "outgoing" : "incoming"}`}
      onContextMenu={(e) => onContextMenu?.(e, msg)}
      data-message-id={msg.Id ?? msg.MessageId}
    >
      <Box
        className={`message-bubble ${isOutgoing ? "outgoing" : "incoming"} ${
          msg.MessageType === "text" ? "text-message" : "media-message"
        } ${isDeleted ? "deleted" : ""} ${isFailed ? "failed" : ""} ${msg.IsStar === 1 ? "starred" : ""}`}
      >
        {/* Hover actions */}
        <MessageActions
          msg={msg}
          isOutgoing={isOutgoing}
          shouldShowActions={shouldShowActions}
          handleForward={isMediaMessage ? onForward : undefined}
          onEmojiSelect={onQuickReaction}
        />

        {/* Menu button */}
        {!isDeleted && (
          <IconButton
            className="menu-btn"
            size="small"
            onClick={(e) => {
              onMenuClick?.(e, msg);
              onContextMenu?.(e, msg);
            }}
            sx={{
              "&&": {
                position: "absolute !important",
                top: "4px !important",
                right: "4px !important",
                padding: "1px !important",
                color: (isOutgoing ? theme.palette.text.secondary : theme.palette.text.primary) + " !important",
                opacity: shouldShowActions ? 1 : 0,
                transform: shouldShowActions ? "translateX(0) scale(1)" : "translateX(8px) scale(0.8)",
                pointerEvents: shouldShowActions ? "auto" : "none",
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%) !important`,
                backdropFilter: "blur(4px) !important",
                borderRadius: "50% !important",
                boxShadow: "0 2px 6px rgba(0,0,0,0.18) !important",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important",
                zIndex: 10,
                "&:hover": {
                  backgroundColor: theme.palette.background.paper + " !important",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.22) !important",
                  transform: "scale(1.1) !important",
                },
              },
            }}
          >
            <ChevronDown size={22} style={{ strokeWidth: 2.5 }} />
          </IconButton>
        )}

        {/* Forwarded indicator */}
        {isForwarded && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mb: 0.5,
              opacity: 0.7,
              color: theme.palette.text.secondary,
            }}
          >
            <Forward size={14} />
            <Typography variant="caption" sx={{ fontSize: "11.5px", fontStyle: "italic", fontWeight: 500 }}>
              Forwarded
            </Typography>
          </Box>
        )}

        {/* Group sender name */}
        {isGroup && !isOutgoing && (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: senderColor,
              display: "block",
              fontSize: "12.5px",
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
            onClick={(e) => {
              e.stopPropagation();
              const memberData = {
                id: (msg as any)?.SenderId,
                UserId: (msg as any).SenderEmail,
                UserName: (msg as any).SenderInfo || (msg as any).Sender,
                FirstName: (msg as any).FirstName,
                LastName: (msg as any).LastName,
                ProfileImageUrl: (msg as any).SenderProfilePicture,
                IsGroup: 0,
                ConversationId: selectedCustomer?.ConversationId,
              };
              window.dispatchEvent(
                new CustomEvent("SHOW_MEMBER_INFO", { detail: memberData })
              );
            }}
          >
            {senderName}
          </Typography>
        )}

        {/* Reply preview */}
        {isReply && (
          <ReplyPreview
            msg={msg}
            original={original}
            isOutgoing={isOutgoing}
            scrollToMessage={scrollToMessage}
            containerRef={containerRef}
          />
        )}

        {/* Main content */}
        {isDeleted ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              fontStyle: "italic",
              pr: 1,
              color: theme.palette.text.secondary,
            }}
          >
            <CircleMinus size={16} />
            <Typography variant="body2" sx={{ fontSize: 13.5, color: "inherit" }}>
              {isOutgoing ? msg.Message1 || msg.Message : msg.Message}
            </Typography>
          </Box>
        ) : msg.MessageType === "text" ? (
          <ReadMoreText
            content={messageText}
            maxLines={20}
            minChars={1200}
            isExpanded={isExpanded}
            onToggle={onToggleExpand}
            sx={{ color: theme.palette.text.primary }}
            mentionUsers={msg.Mentions || msg.MentionUsers}
            highlightQuery={highlightQuery}
          />
        ) : (
          <Box sx={{ maxWidth: msg.MessageType === "document" ? 350 : 250, width: "100%" }}>
            <MediaMessage
              msg={msg}
              handleMediaClick={onMediaClick}
              getMediaKey={getMediaKey}
              loadedMedia={loadedMedia}
              markLoaded={markLoaded}
            />
            {msg.Message && (
              <ReadMoreText
                content={messageText}
                maxLines={20}
                minChars={1200}
                isExpanded={isExpanded}
                onToggle={onToggleExpand}
                sx={{ mt: 0.5, color: theme.palette.text.primary }}
                mentionUsers={msg.Mentions || msg.MentionUsers}
                highlightQuery={highlightQuery}
              />
            )}
          </Box>
        )}

        {/* Footer: time + status */}
        <Box
          className="message-footer"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.5,
            whiteSpace: "nowrap",
            mt: 0.5,
          }}
        >
          {msg.IsEdited === 1 && (
            <Typography variant="caption" sx={{ fontSize: 11, color: alpha(theme.palette.text.primary, 0.65) }}>
              Edited
            </Typography>
          )}
          {msg.IsStar === 1 && (
            <Star
              size={12}
              fill="#FFD700"
              color="#FFD700"
              style={{ flexShrink: 0 }}
            />
          )}
          <Typography
            variant="caption"
            className="message-time"
            sx={{ color: alpha(theme.palette.text.primary, 0.65), fontSize: 11 }}
          >
            {time}
          </Typography>
          {isOutgoing && !isPending && !msg.isUploading && (
            <Box sx={{ display: "flex", alignItems: "center", lineHeight: 1 }}>
              {statusKey && (
                <CheckCheck
                  size={17}
                  strokeWidth={2.5}
                  style={{
                    marginLeft: 4,
                    color: isFailed
                      ? theme.palette.error.main
                      : statusKey === "read"
                      ? "#1F8FFF"
                      : statusKey === "delivered"
                      ? alpha(theme.palette.text.primary, 0.55)
                      : alpha(theme.palette.text.primary, 0.45),
                  }}
                />
              )}
            </Box>
          )}
          {isOutgoing && isPending && (
            <Box sx={{ display: "flex", alignItems: "center", lineHeight: 1 }}>
              <Clock
                size={16}
                style={{
                  marginLeft: 4,
                  color: alpha(theme.palette.text.primary, 0.5),
                  animation: "spin 1s linear infinite",
                }}
              />
            </Box>
          )}
          {isFailed && (
            <Tooltip title="Message failed. Retry" arrow>
              <IconButton
                size="small"
                aria-label="Retry sending message"
                onClick={(event) => {
                  event.stopPropagation();
                  onRetry?.(msg);
                }}
                sx={{
                  p: 0.25,
                  color: theme.palette.error.main,
                  "&:hover": { backgroundColor: alpha(theme.palette.error.main, 0.12) },
                }}
              >
                <RotateCcw size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Reactions */}
        {msg.ReactionEmojis && msg.ReactionEmojis !== "" && msg.ReactionEmojis !== "[]" && (
          <Box
            className={`message-reaction ${isOutgoing ? "outgoing" : "incoming"}`}
            onClick={(e) => {
              e.stopPropagation();
              setReactionAnchorEl(e.currentTarget);
            }}
            sx={{
              position: "absolute",
              bottom: -24,
              display: "flex",
              alignItems: "center",
              padding: "2px 8px",
              background: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: "20px",
              boxShadow: "0 3px 8px rgba(0,0,0,0.12)",
              zIndex: 10,
              cursor: "pointer",
              gap: "2px",
              ...(isOutgoing ? { right: 25 } : { left: 12 }),
            }}
          >
            {(() => {
              try {
                const reactions = JSON.parse(msg.ReactionEmojis);
                if (Array.isArray(reactions)) {
                  // Group identical reactions with count
                  const emojiGroups = new Map<string, { Reaction?: string; Emoji?: string; Unified?: string; count: number }>();
                  reactions.forEach((r: { Reaction?: string; Emoji?: string; Unified?: string }) => {
                    const emojiChar = r.Reaction || r.Emoji || "";
                    if (!emojiGroups.has(emojiChar)) {
                      emojiGroups.set(emojiChar, { ...r, count: 1 });
                    } else {
                      emojiGroups.get(emojiChar)!.count++;
                    }
                  });

                  const uniqueReactions = Array.from(emojiGroups.values());
                  const displayReactions = uniqueReactions.slice(0, 3);
                  const remainingCount = uniqueReactions.length - 3;

                  return (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {displayReactions.map((r, idx) => {
                        const emojiChar = r.Reaction || r.Emoji;
                        const unified = r.Unified || charToUnified(emojiChar);
                        return (
                          <Box
                            key={idx}
                            className="emoji-item"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.3,
                              px: 0.1,
                            }}
                          >
                            {unified ? (
                              <Emoji unified={unified} size={18} emojiStyle={EmojiStyle.APPLE} />
                            ) : (
                              <span style={{ fontSize: 16 }}>{emojiChar}</span>
                            )}
                            {r.count > 1 && (
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  opacity: 0.9,
                                  lineHeight: 1,
                                  ml: -0.1,
                                  color: theme.palette.text.secondary,
                                }}
                              >
                                {r.count}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                      {remainingCount > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: theme.palette.text.secondary,
                            ml: 0.2,
                            opacity: 0.8,
                          }}
                        >
                          +{remainingCount}
                        </Typography>
                      )}
                    </Box>
                  );
                }
              } catch {
                /* ignore */
              }
              return null;
            })()}
          </Box>
        )}
      </Box>

      {/* Reaction details menu */}
      {parsedReactions.length > 0 && (
        <ReactionDetailsMenu
          anchorEl={reactionAnchorEl}
          onClose={() => setReactionAnchorEl(null)}
          reactions={parsedReactions}
          currentUserId={auth?.id ?? auth?.userId}
          onRemoveReaction={(reaction) => {
            onRemoveReaction?.(reaction, msg);
            setReactionAnchorEl(null);
          }}
        />
      )}
    </Box>
  );
};

export const MessageBubble = memo(MessageBubbleComponent);
export default MessageBubble;
