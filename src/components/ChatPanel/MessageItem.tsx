"use client";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { MessageBubble } from "./MessageBubble";
import { ConversationAvatar } from "../ConversationAvatar/ConversationAvatar";
import { SystemMessage } from "./messages/list";
import type { ChatMessage } from "../../types/message";
import type { ConversationListEntry } from "../../types/conversation";
import { getMessageId } from "./CoreLogic/messageHelpers";

interface MessageItemProps {
  msg: ChatMessage;
  index: number;
  isGroup: boolean;
  conversationId?: string | number | null;
  blinkMessageId: string | null;
  searchHighlightQuery?: string | null;
  searchHighlightMessageId?: string | null;
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
  isExpanded?: boolean;
  onToggleExpand?: (id: string | number) => void;
  auth?: { id?: string | number; userId?: string | number } | null;
}

const MessageItemComponent = ({
  msg,
  index,
  isGroup,
  conversationId,
  blinkMessageId,
  searchHighlightQuery,
  searchHighlightMessageId,
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
  getMediaSrcForMessage,
  messageById,
  scrollToMessage,
  containerRef,
  isExpanded = false,
  onToggleExpand,
  auth,
}: MessageItemProps) => {
  const [hovered, setHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messageDomId = getMessageId(msg);
  const isBlinking =
    blinkMessageId != null && String(blinkMessageId) === String(messageDomId);
  const isSearchHighlighted = searchHighlightMessageId === String(messageDomId);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHovered(false), 220);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  if (msg.SystemMsg === 1) {
    return <SystemMessage message={msg.Message} />;
  }

  const isOutgoing = msg.Direction === 1;

  return (
    <Box
      className={`message-item ${isOutgoing ? "user-message" : "customer-message"} ${
        isBlinking ? "blink-message" : ""
      }`}
      sx={{ cursor: "context-menu" }}
      data-message-id={messageDomId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isGroup && !isOutgoing && (
        <Box
          sx={{
            marginRight: "8px",
            alignSelf: "flex-end",
            marginBottom: "4px",
          }}
        >
          <ConversationAvatar
            member={{
              UserName: (msg as { SenderName?: string }).SenderName || (msg as { SenderInfo?: string }).SenderInfo,
              FirstName: (msg as { FirstName?: string }).FirstName,
              LastName: (msg as { LastName?: string }).LastName,
              ProfileImageUrl: (msg as { SenderProfilePicture?: string }).SenderProfilePicture,
              IsGroup: 0,
            } as unknown as ConversationListEntry}
            size={38}
          />
        </Box>
      )}
      <MessageBubble
        msg={msg}
        isOutgoing={isOutgoing}
        isGroup={isGroup}
        conversationId={conversationId}
        getMessageStatusIcon={getMessageStatusIcon}
        onContextMenu={onContextMenu}
        onMenuClick={onMenuClick}
        onForward={onForward}
        onQuickReaction={onQuickReaction}
        onRemoveReaction={onRemoveReaction}
        onMediaClick={onMediaClick}
        onRetry={onRetry}
        getMediaKey={getMediaKey}
        loadedMedia={loadedMedia}
        markLoaded={markLoaded}
        getMediaSrcForMessage={getMediaSrcForMessage}
        messageById={messageById}
        scrollToMessage={scrollToMessage}
        containerRef={containerRef}
        shouldShowActions={hovered}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        auth={auth}
        highlightQuery={isSearchHighlighted ? searchHighlightQuery : undefined}
      />
    </Box>
  );
};

const arePropsEqual = (prev: MessageItemProps, next: MessageItemProps): boolean => {
  for (const key of Object.keys(next) as Array<keyof MessageItemProps>) {
    if (key === "loadedMedia") continue;
    if (prev[key] !== next[key]) return false;
  }
  if (prev.loadedMedia !== next.loadedMedia) {
    const count = Math.max(prev.msg?.mediaItems?.length ?? 0, 1);
    for (let i = 0; i < count; i++) {
      const k = prev.getMediaKey(prev.msg, i);
      if (prev.loadedMedia[k] !== next.loadedMedia[k]) return false;
    }
  }
  return true;
};

export default memo(MessageItemComponent, arePropsEqual);
