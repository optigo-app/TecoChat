"use client";

import React, { memo, useState, useRef, useCallback } from "react";
import { Typography, Badge, IconButton, Tooltip } from "@mui/material";
import { ChevronDown, Pin, Star, CheckCheck, UploadCloud, BellOff } from "lucide-react";
import { ConversationAvatar } from "../ConversationAvatar/ConversationAvatar";
import { highlightText } from "./CustomerListFunc";
import { normalizeMessageText } from "../../utils/globalFunc";
import { renderMessageText } from "../../utils/messageTextRenderer";
import { queueDroppedFiles } from "../../utils/dropFileQueue";
import { isConversationMuted } from "../../utils/mentionUtils";
import type { ConversationListEntry, TypingState } from "../../types/conversation";

interface ConversationItemProps {
  member: ConversationListEntry;
  isSelected: boolean;
  isSelectedAndReading: boolean;
  isKeyboardSelected: boolean;
  isMenuOpen: boolean;
  shouldShowUnreadBadge: boolean;
  typingState?: TypingState;
  draftText?: string;
  searchTerm: string;
  handleCustomerClick: (member: ConversationListEntry) => void;
  setAnchorEl: (el: HTMLElement | null) => void;
  setSelectMember: (member: ConversationListEntry) => void;
  setMenuPosition: (pos: { top: number; left: number } | null) => void;
}

const ConversationItemComponent: React.FC<ConversationItemProps> = ({
  member,
  isSelected,
  isSelectedAndReading,
  isKeyboardSelected,
  isMenuOpen,
  shouldShowUnreadBadge,
  typingState,
  draftText,
  searchTerm,
  handleCustomerClick,
  setAnchorEl,
  setSelectMember,
  setMenuPosition,
}) => {
  const conversationId = (member as { ConversationId?: string | number }).ConversationId;
  const isGroup = (member as { IsGroup?: number }).IsGroup === 1;
  const unreadCount = Number((member as { unreadCount?: number }).unreadCount ?? 0);
  const name = (member as { name?: string }).name || "Unknown";
  const lastMessageTime = (member as { lastMessageTime?: string }).lastMessageTime || "";
  const lastMessage = (member as { lastMessage?: React.ReactNode }).lastMessage;
  const lastMessageDirection = (member as { LastMessageDirection?: number }).LastMessageDirection;
  const isOutgoing = lastMessageDirection === 1;
  const isPinned = (member as { IsPin?: number }).IsPin === 1;
  const isStarred = (member as { IsStar?: number }).IsStar === 1;
  const isSearchResult = (member as { isSearchResult?: boolean }).isSearchResult;
  const lastMessageStatus = (member as { LastMessageStatus?: number }).LastMessageStatus;
  const isMuted = isConversationMuted(
    (member as { IsMuted?: number }).IsMuted,
    (member as { MuteExpiresAt?: string | null }).MuteExpiresAt
  );

  // More button visible when selected or menu open (CSS handles hover)
  const moreVisible = isSelected || isMenuOpen;

  // ── Drag and drop external files ──────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const isExternalFileDrag = useCallback((e: React.DragEvent): boolean => {
    const types = e.dataTransfer?.types;
    if (!types?.includes("Files")) return false;
    if (types.includes("text/uri-list") || types.includes("text/html")) return false;
    return true;
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExternalFileDrag(e)) return;
    dragCounter.current++;
    if (e.dataTransfer.items?.length > 0) setIsDragOver(true);
  }, [isExternalFileDrag]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExternalFileDrag(e)) return;
    if (--dragCounter.current === 0) setIsDragOver(false);
  }, [isExternalFileDrag]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (!isExternalFileDrag(e)) return;
    if (e.dataTransfer.files?.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      queueDroppedFiles(conversationId ?? 0, files);
      handleCustomerClick(member);
    }
  }, [conversationId, member, handleCustomerClick, isExternalFileDrag]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPosition(null);
    setAnchorEl(e.currentTarget as HTMLElement);
    setSelectMember(member);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchorEl(null);
    setMenuPosition({ top: e.clientY - 4, left: e.clientX - 4 });
    setSelectMember(member);
  };

  // Typing indicator
  const showTyping = typingState?.isTyping;
  const showDraft = draftText && !isSelected;

  return (
    <li
      className={`member-item ${isSelected ? "active" : ""} ${isSelectedAndReading ? "reading" : ""} ${isKeyboardSelected ? "keyboard-selected" : ""} ${isMenuOpen ? "menu-open" : ""} ${isDragOver ? "drag-over" : ""}`}
      onClick={() => handleCustomerClick(member)}
      onContextMenu={handleContextMenu}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            zIndex: 10,
            pointerEvents: "none",
            background: "rgba(115, 103, 240, 0.12)",
            border: "2px dashed rgba(115, 103, 240, 0.5)",
            borderRadius: 8,
            boxSizing: "border-box",
            color: "#7367f0",
            fontSize: 13,
            fontWeight: 600,
            animation: "dropPulse 1.2s ease-in-out infinite",
          }}
        >
          <UploadCloud size={20} style={{ flexShrink: 0 }} />
          <span>Drop to send</span>
        </div>
      )}
      <div className="member-item">
        {/* Avatar */}
        <div className="member-avatar">
          <ConversationAvatar member={member} size={40} />
        </div>

        {/* Info */}
        <div className="member-info">
          {/* Header: name + time */}
          <div className="member-header">
            <Typography
              className={unreadCount > 0 ? "member-name-unread" : "member-name"}
              component="span"
            >
              {isSearchResult ? name : highlightText(name, searchTerm)}
            </Typography>
            <Typography className="member-time" component="span">
              {lastMessageTime}
            </Typography>
          </div>

          {/* Message row */}
          <div className="member-message">
            <Typography
              className={unreadCount > 0 ? "last-message-unread" : "last-message"}
              component="span"
            >
              {showTyping ? (
                <span className="typing_indecator">
                  <div className="typing-dots-container sidebar-dots">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                  {isGroup && typingState?.userName
                    ? `${typingState.userName} is typing...`
                    : "typing..."}
                </span>
              ) : showDraft ? (
                <span>
                  <span style={{ color: "#7367f0", fontWeight: 500 }}>Draft: </span>
                  {draftText}
                </span>
              ) : (
                <span className="last-message-content">
                  {isOutgoing && !isSearchResult && (
                    <CheckCheck
                      size={15}
                      strokeWidth={2.5}
                      style={{
                        flexShrink: 0,
                        color: lastMessageStatus === 3 ? "#1F8FFF" : "#9e9e9e",
                      }}
                    />
                  )}
                  <span className="last-message-text">
                    {typeof lastMessage === "string" && lastMessage ? (
                      renderMessageText(
                        normalizeMessageText(String(lastMessage)).replace(/\n|\r/g, " ")
                      )
                    ) : (
                      lastMessage || "Tap to chat"
                    )}
                  </span>
                </span>
              )}
            </Typography>

            <div className="member-trailing">
              {/* Unread badge */}
              {shouldShowUnreadBadge && unreadCount > 0 && (
                <Badge
                  badgeContent={unreadCount}
                  color="primary"
                  className="unread-badge"
                  max={99}
                />
              )}

              {/* Actions bar — always rendered to prevent layout shift */}
              <div className="member-actions-bar">
                {/* Mute — always visible when muted */}
                {isMuted && (
                  <Tooltip title="Unmute" arrow>
                    <IconButton size="small" className="action-btn is-on" sx={{ padding: "3px" }}>
                      <BellOff size={15} style={{ color: "var(--color-text-secondary)" }} />
                    </IconButton>
                  </Tooltip>
                )}

                {/* Pin — always visible when pinned */}
                {isPinned && (
                  <Tooltip title="Unpin" arrow>
                    <IconButton size="small" className="action-btn is-on" sx={{ padding: "3px" }}>
                      <Pin size={15} />
                    </IconButton>
                  </Tooltip>
                )}

                {/* Star — always visible when favorited */}
                {isStarred && (
                  <Tooltip title="Unfavorite" arrow>
                    <IconButton size="small" className="action-btn is-on" sx={{ padding: "3px" }}>
                      <Star size={15} style={{ fill: "var(--color-warning)", color: "var(--color-warning)" }} />
                    </IconButton>
                  </Tooltip>
                )}

                {/* More button — fades in on hover/selected, reserves space */}
                <div className={`more-btn-wrapper ${moreVisible ? "is-visible" : ""}`}>
                  <Tooltip title="More" arrow>
                    <IconButton
                      size="small"
                      className="action-btn more-btn"
                      onClick={handleMenuClick}
                      aria-label="More options"
                      sx={{ padding: "3px" }}
                    >
                      <ChevronDown size={16} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

export const ConversationItem = memo(ConversationItemComponent);
