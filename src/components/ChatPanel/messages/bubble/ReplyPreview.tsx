"use client";

// Ported from OldChatReactCode/src/components/chat/messages/ReplyPreview.jsx
// Renders the reply quote card inside a message bubble.
// Shows sender name, preview text (or media label), and thumbnail for media messages.
// Clicking scrolls to the original message.

import { memo } from "react";
import { Box, Typography, useTheme, alpha } from "@mui/material";
import { Image as ImageIcon, Video as VideoIcon, FileText } from "lucide-react";
import { renderMessageText } from "../../../../utils/messageTextRenderer";
import { getSoftAvatarColors } from "../../../../utils/globalFunc";
import type { ChatMessage } from "../../../../types/message";

interface ReplyPreviewProps {
  msg: ChatMessage;
  original?: ChatMessage | null;
  isOutgoing: boolean;
  scrollToMessage?: (
    messageId: string | number,
    containerRef: React.MutableRefObject<HTMLElement | null>,
    attachmentId?: string | null
  ) => void;
  containerRef?: React.MutableRefObject<HTMLElement | null>;
}

const ReplyPreviewComponent = ({
  msg,
  original,
  isOutgoing,
  scrollToMessage,
  containerRef,
}: ReplyPreviewProps) => {
  const theme = useTheme();

  if (!msg.ContextId) return null;

  const isGenericReply =
    !msg?.ReplyContextMsg ||
    String(msg.ReplyContextMsg).trim() === "" ||
    String(msg.ReplyContextMsg).trim().toLowerCase() === "media";

  const mediaCount = Array.isArray((original as any)?.mediaItems)
    ? (original as any).mediaItems.length
    : 0;
  const originalType = original?.MessageType;
  const originalFileName =
    (original as any)?.fileName ||
    (original as any)?.mediaItems?.[0]?.filename ||
    (original as any)?.mediaItems?.[0]?.fileName;

  const computedIcon = (() => {
    if (!original) return null;
    if (originalType === "image") return ImageIcon;
    if (originalType === "video") return VideoIcon;
    if (originalType === "document") return FileText;
    return null;
  })();

  const isSpecificItem = !!(msg as any).ReplyToAttachmentId;
  const computedReplyText = (() => {
    if (!original) return msg?.ReplyContextMsg;
    if (!isGenericReply) return msg?.ReplyContextMsg;

    if (originalType === "image") {
      const suffix = mediaCount > 1 && !isSpecificItem ? `${mediaCount} Photos` : "Photo";
      return `Media ${suffix}`;
    }
    if (originalType === "video") {
      const suffix = mediaCount > 1 && !isSpecificItem ? `${mediaCount} Videos` : "Video";
      return `Media ${suffix}`;
    }
    if (originalType === "document") return originalFileName || "Document";
    if (originalType === "text") return original?.Message || msg?.ReplyContextMsg;
    return msg?.ReplyContextMsg;
  })();

  const computedSender =
    (original as any)?.Direction === 1
      ? "You"
      : (original as any)?.FirstName || (original as any)?.LastName
      ? `${(original as any).FirstName || ""} ${(original as any).LastName || ""}`.trim()
      : (original as any)?.SenderInfo ||
        (original as any)?.Sender ||
        ((msg as any).SenderInfo !== "" ? (msg as any).SenderInfo : (msg as any).Sender) ||
        "Customer";

  // WhatsApp-style: consistent color per sender name (matches avatar color)
  const senderColor = computedSender === "You"
    ? theme.palette.text.primary
    : (theme.palette.mode === "dark"
        ? getSoftAvatarColors(String(computedSender || "unknown")).fgDark
        : getSoftAvatarColors(String(computedSender || "unknown")).fg);

  // --- Reply Thumbnail Resolution ---
  const replyAttachIds = (msg as any).ReplyToAttachmentId
    ? String((msg as any).ReplyToAttachmentId)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const firstReplyAttachId = replyAttachIds[0] || null;

  const parseAttachments = (raw: any): any[] => {
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const findByReplyId = (arr: any[]) =>
    arr.find((a) => {
      const id = String(a?.Id || a?.id || a?.attachmentId || a?.AttachmentId || "");
      return replyAttachIds.includes(id);
    });

  let replyMediaUrl: string | null = null;
  if (firstReplyAttachId) {
    const msgAttachments = parseAttachments((msg as any).Attachments);
    const matched = findByReplyId(msgAttachments);
    if (matched) replyMediaUrl = matched.FileUrl || matched.fileUrl || matched.Url || matched.url;
  }

  if (!replyMediaUrl && firstReplyAttachId && (original as any)?.mediaItems) {
    const matchedItem = (original as any).mediaItems.find((item: any) => {
      const id = String(item.attachmentId || item.AttachmentId || item.Id || item.id || "");
      return replyAttachIds.includes(id);
    });
    replyMediaUrl = matchedItem?.url || matchedItem?.src || null;
  }

  if (!replyMediaUrl && firstReplyAttachId && (original as any)?.Attachments) {
    const origAttachments = parseAttachments((original as any).Attachments);
    const matched = findByReplyId(origAttachments);
    if (matched) replyMediaUrl = matched.FileUrl || matched.fileUrl || matched.url || matched.Url;
  }

  if (!replyMediaUrl) {
    replyMediaUrl =
      (original as any)?.previewUrl ||
      (original as any)?.mediaItems?.[0]?.url ||
      (original as any)?.mediaItems?.[0]?.src ||
      null;
  }

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        if (msg.ContextId && scrollToMessage && containerRef) {
          scrollToMessage(msg.ContextId, containerRef, (msg as any).ReplyToAttachmentId as string | null);
        }
      }}
      sx={{
        display: "flex",
        gap: 1,
        padding: "8px",
        backgroundColor: isOutgoing
          ? "var(--color-bubble-outgoing-reply)"
          : "var(--color-bubble-incoming-reply)",
        borderRadius: "8px",
        marginBottom: "8px",
        borderLeft: `3px solid ${theme.palette.primary.main}`,
        cursor: msg.ContextId ? "pointer" : "default",
        opacity: msg.ContextId ? 1 : 0.7,
        alignItems: "center",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: senderColor, mb: "2px" }}
        >
          {computedSender}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {computedIcon &&
            (() => {
              const Icon = computedIcon;
              return <Icon size={14} />;
            })()}
          <Typography
            variant="caption"
            sx={{
              minWidth: 0,
              flex: 1,  
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              lineHeight: 1.3,
              maxHeight: "2.6em",
              wordBreak: "break-word",
              overflowWrap: "break-word",
              color: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.9 : 0.7),
            }}
          >
            {computedReplyText ? renderMessageText(computedReplyText as string) : ""}
          </Typography>
        </Box>
        {!msg.ContextId && (
          <Typography
            variant="caption"
            sx={{ color: theme.palette.error.main, fontSize: "10px", mt: "2px" }}
          >
            Original message not available
          </Typography>
        )}
      </Box>

      {/* Image thumbnails (up to 2, with +N overflow) */}
      {replyMediaUrl && originalType === "image" &&
        (() => {
          const allThumbs =
            Array.isArray((original as any)?.mediaItems) && (original as any).mediaItems.length
              ? (original as any).mediaItems
                  .map((item: any) => item?.url || item?.src)
                  .filter(Boolean)
              : [replyMediaUrl];

          const thumbsToShow = isSpecificItem ? [replyMediaUrl] : allThumbs.slice(0, 2);
          const overflowCount = isSpecificItem ? 0 : allThumbs.length - 2;

          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
              {thumbsToShow.map((thumbSrc: string, idx: number) => (
                <Box
                  key={idx}
                  sx={{
                    position: "relative",
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    overflow: "hidden",
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                  }}
                >
                  <img
                    src={thumbSrc}
                    alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    draggable="false"
                  />
                  {idx === 1 && overflowCount > 0 && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: alpha("#000", 0.45),
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      +{overflowCount}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          );
        })()}

      {/* Non-image thumbnail (video/document) */}
      {replyMediaUrl && originalType !== "image" && (
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1,
            overflow: "hidden",
            flexShrink: 0,
            backgroundColor: alpha(theme.palette.text.primary, 0.05),
            border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
          }}
        >
          {String(replyMediaUrl).match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
            <video
              src={replyMediaUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <img
              src={replyMediaUrl}
              alt="preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              draggable="false"
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default memo(ReplyPreviewComponent);
