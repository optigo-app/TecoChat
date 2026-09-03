"use client";

import { memo, useRef, useState } from "react";
import { IconButton, Tooltip, Avatar, useTheme, alpha } from "@mui/material";
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Reply,
  Forward,
  Smile,
  User,
  FileText,
} from "lucide-react";
import { Emoji } from "emoji-picker-react";
import {
  getCustomerDisplayName,
  getWhatsAppAvatarConfig,
  getCustomerAvatarSeed,
  hasCustomerName,
  handleDownloadFile,
} from "../../../../utils/globalFunc";
import { formatDateTime } from "../../../../utils/dateUtils";
import { charToUnified, parseReactions } from "../../../../utils/EmojiUtils";
import { QuickReactionMenu, ReactionDetailsMenu } from "../interactions";
import type { ChatMessage } from "../../../../types/message";
import type { ConversationListEntry } from "../../../../types/conversation";

// ─────────────────────────────────────────────────────────────────────────────
// Reusable viewer header — used by both MediaViewer and PdfViewerDialog.
// Shows: avatar + name + timestamp on the left, toolbar on the right.
// Toolbar actions are configured via props — only rendered if callback exists.
// ─────────────────────────────────────────────────────────────────────────────

export interface ViewerToolbarAction {
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomLevel?: number;
  onResetZoom?: () => void;
}

interface MediaViewerHeaderProps {
  // Identity
  selectedCustomer?: ConversationListEntry | null;
  message?: ChatMessage | null;
  liveMessage?: ChatMessage | null;
  // File info (for PDF viewer — shown instead of customer name)
  fileName?: string;
  fileSize?: number;
  filePageCount?: number;
  // Toolbar actions
  onDownload?: () => void;
  onReply?: (msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage) => void;
  onQuickReaction?: (emoji: string, msg: ChatMessage) => void;
  onRemoveReaction?: (reaction: { Emoji?: string; Reaction?: string }, msg: ChatMessage) => void;
  onClose: () => void;
  // Zoom controls (optional — only shown if zoomIn/zoomOut provided)
  zoom?: ViewerToolbarAction;
  // Extra toolbar elements (e.g. page count for PDF)
  extraToolbar?: React.ReactNode;
}

function MediaViewerHeaderComponent({
  selectedCustomer,
  message,
  liveMessage,
  fileName,
  fileSize,
  filePageCount,
  onDownload,
  onReply,
  onForward,
  onQuickReaction,
  onRemoveReaction,
  onClose,
  zoom,
  extraToolbar,
}: MediaViewerHeaderProps) {
  const theme = useTheme();
  const reactionButtonRef = useRef<HTMLButtonElement | null>(null);
  const [reactionAnchorEl, setReactionAnchorEl] = useState<HTMLElement | null>(null);
  const [detailAnchorEl, setDetailAnchorEl] = useState<HTMLElement | null>(null);

  const time = message?.Time || (message?.DateTime ? formatDateTime(message.DateTime, "time") : "");
  const msgForActions = liveMessage || message;

  // Parse reactions for the details menu
  const reactions = msgForActions ? parseReactions(msgForActions as any) : [];
  const myReaction = (() => {
    if (!msgForActions) return null;
    const reactionsRaw = (msgForActions as any)?.Reactions;
    if (!reactionsRaw) return null;
    try {
      const parsed = typeof reactionsRaw === "string"
        ? JSON.parse(reactionsRaw)
        : reactionsRaw;
      if (!Array.isArray(parsed)) return null;
      const mine = parsed.find((r: any) => r?.isMe || r?.IsMe);
      return mine ? (mine.Emoji || mine.Reaction || null) : null;
    } catch {
      return null;
    }
  })();

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="media-viewer-header">
      {/* Left: identity */}
      <div className="media-viewer-header-left">
        {fileName ? (
          // PDF viewer mode — show file info instead of customer
          <>
            <div
              className="document-icon pdf"
              style={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#f24e1e",
                background: "rgba(242, 78, 30, 0.1)",
              }}
            >
              <FileText size={20} />
            </div>
            <div className="media-viewer-user-info">
              <div className="media-viewer-username" title={fileName}>
                {fileName}
              </div>
              <div className="media-viewer-timestamp">
                PDF
                {fileSize != null && ` · ${formatSize(fileSize)}`}
                {filePageCount != null && filePageCount > 0 && ` · ${filePageCount} pages`}
              </div>
            </div>
          </>
        ) : (
          // Media viewer mode — show customer
          selectedCustomer && (
            <>
              {!hasCustomerName(selectedCustomer) ? (
                <Avatar {...getWhatsAppAvatarConfig(getCustomerAvatarSeed(selectedCustomer), 32)}>
                  <User size={20} />
                </Avatar>
              ) : (
                <Avatar {...getWhatsAppAvatarConfig(getCustomerDisplayName(selectedCustomer), 32)} />
              )}
              <div className="media-viewer-user-info">
                <div className="media-viewer-username">
                  {getCustomerDisplayName(selectedCustomer)}
                </div>
                {time && <div className="media-viewer-timestamp">{time}</div>}
              </div>
            </>
          )
        )}
      </div>

      {/* Right: toolbar */}
      <div className="media-viewer-header-right">
        <div className="media-viewer-toolbar">
          {/* Zoom controls */}
          {zoom?.zoomIn && (
            <Tooltip title="Zoom In" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
              <IconButton className="toolbar-btn" onClick={zoom.zoomIn} size="small">
                <ZoomIn size={18} />
              </IconButton>
            </Tooltip>
          )}
          {zoom?.zoomOut && (
            <Tooltip title="Zoom Out" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
              <IconButton className="toolbar-btn" onClick={zoom.zoomOut} size="small">
                <ZoomOut size={18} />
              </IconButton>
            </Tooltip>
          )}
          {zoom?.zoomLevel != null && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                minWidth: 42,
                textAlign: "center",
                color: "var(--color-title)",
                cursor: zoom.onResetZoom ? "pointer" : "default",
                userSelect: "none",
              }}
              onClick={zoom.onResetZoom}
              title="Reset zoom"
            >
              {Math.round(zoom.zoomLevel * 100)}%
            </span>
          )}

          {/* Extra toolbar (e.g. page nav for PDF) */}
          {extraToolbar}

          {/* Divider before action buttons */}
          {(zoom?.zoomIn || onReply || onQuickReaction || onForward || onDownload) && (
            <div className="toolbar-divider" />
          )}

          {/* Reply */}
          {onReply && message && (
            <Tooltip title="Reply" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
              <IconButton
                className="toolbar-btn"
                onClick={() => {
                  onReply(msgForActions || message);
                  onClose();
                }}
                size="small"
              >
                <Reply size={18} />
              </IconButton>
            </Tooltip>
          )}

          {/* Quick reaction */}
          {onQuickReaction && message && (
            <>
              <Tooltip title="React" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
                <IconButton
                  ref={reactionButtonRef}
                  className="toolbar-btn reaction-btn"
                  onClick={(e) => setReactionAnchorEl(e.currentTarget)}
                  size="small"
                >
                  <Smile size={18} />
                </IconButton>
              </Tooltip>
              <QuickReactionMenu
                open={Boolean(reactionAnchorEl)}
                anchorEl={reactionAnchorEl}
                hideTrigger={true}
                disablePortal={true}
                onClose={() => setReactionAnchorEl(null)}
                onSelectEmoji={(emoji: string) => {
                  onQuickReaction(emoji, msgForActions || message!);
                  setReactionAnchorEl(null);
                }}
              />
            </>
          )}

          {/* Forward */}
          {onForward && message && (
            <Tooltip title="Forward" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
              <IconButton
                className="toolbar-btn"
                onClick={() => {
                  onForward(msgForActions || message);
                  onClose();
                }}
                size="small"
              >
                <Forward size={18} />
              </IconButton>
            </Tooltip>
          )}

          {/* Download */}
          {onDownload && (
            <Tooltip title="Download" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
              <IconButton className="toolbar-btn" onClick={onDownload} size="small">
                <Download size={18} />
              </IconButton>
            </Tooltip>
          )}

          {/* Reaction details (if reactions exist) */}
          {reactions.length > 0 && onRemoveReaction && (
            <ReactionDetailsMenu
              anchorEl={detailAnchorEl}
              reactions={reactions}
              onClose={() => setDetailAnchorEl(null)}
              onRemoveReaction={(reaction: any) => {
                onRemoveReaction(reaction, msgForActions || message!);
                setDetailAnchorEl(null);
              }}
            />
          )}

          {/* Divider + Close */}
          <div className="toolbar-divider" />
          <Tooltip title="Close" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
            <IconButton className="toolbar-btn media-viewer-close" onClick={onClose} size="small">
              <X size={20} />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default memo(MediaViewerHeaderComponent);
