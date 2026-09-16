"use client";

import { memo, useMemo } from "react";
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  alpha,
} from "@mui/material";
import { Reply, Forward, Copy, Trash2, Info, User, Edit2, Download, Star } from "lucide-react";
import toast from "react-hot-toast";
import { handleDownloadFile, isMessageEditable, normalizeMessageText } from "../../../../utils/globalFunc";
import { messageTextToHtml } from "../../../../utils/messageTextRenderer";
import type { ChatMessage } from "../../../../types/message";
import type { ConversationListEntry } from "../../../../types/conversation";

interface MessageContextMenuProps {
  open: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  mouseX: number | null;
  mouseY: number | null;
  onReply?: (msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage) => void;
  onDelete?: (msg: ChatMessage) => void;
  onEdit?: (msg: ChatMessage) => void;
  onMessageInfo?: (msg: ChatMessage) => void;
  onMemberRedirect?: (msg: ChatMessage) => void;
  onStar?: (msg: ChatMessage) => void;
  canDelete?: boolean;
  selectedCustomer?: ConversationListEntry | null;
}

const MessageContextMenuComponent = ({
  open,
  onClose,
  message,
  mouseX,
  mouseY,
  onReply,
  onForward,
  onDelete,
  onEdit,
  onMessageInfo,
  onMemberRedirect,
  onStar,
  canDelete = true,
  selectedCustomer,
}: MessageContextMenuProps) => {
  const theme = useTheme();
  const timeLimit = parseInt(process.env.NEXT_PUBLIC_MESSAGE_EDIT_TIME_LIMIT || "15", 10);

  const isWithinTimeLimit = useMemo(() => {
    return isMessageEditable(message, timeLimit);
  }, [message, timeLimit]);

  if (!message) return null;

  const isOutgoing = message.Direction === 1;
  const isText = message.MessageType === "text";
  const isGroup = (selectedCustomer as { IsGroup?: number })?.IsGroup === 1;
  const removeInGroup = (selectedCustomer as { RemoveInGroup?: number })?.RemoveInGroup;
  const isDeleted = message.IsDeletedForEveryone === 1;

  const handleCopy = () => {
    if (message.Message) {
      // Normalize: unescape \n, unescape markdown escape sequences
      const plainText = normalizeMessageText(message.Message);
      // Convert markdown to formatted HTML for rich editors (ChatGPT, Gmail, Word, etc.)
      const htmlText = messageTextToHtml(plainText);

      // Write BOTH formats to the clipboard:
      // - text/html: rich editors use this → shows formatted text (no * markers)
      // - text/plain: WhatsApp, plain text editors use this → WhatsApp re-parses markers
      const writeRichClipboard = async () => {
        try {
          if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
            const htmlBlob = new Blob([htmlText], { type: "text/html" });
            const textBlob = new Blob([plainText], { type: "text/plain" });
            await navigator.clipboard.write([
              new ClipboardItem({
                "text/html": htmlBlob,
                "text/plain": textBlob,
              }),
            ]);
          } else {
            // Fallback: use a temporary contenteditable + execCommand for older browsers
            const listener = (e: ClipboardEvent) => {
              e.clipboardData?.setData("text/html", htmlText);
              e.clipboardData?.setData("text/plain", plainText);
              e.preventDefault();
            };
            document.addEventListener("copy", listener);
            document.execCommand("copy");
            document.removeEventListener("copy", listener);
          }
          toast.success("Text Copied");
        } catch {
          // Final fallback: plain text only
          navigator.clipboard.writeText(plainText).then(() => toast.success("Text Copied"));
        }
      };
      writeRichClipboard();
    }
  };

  const handleDownload = () => {
    const mediaItems = (message as { mediaItems?: Array<{ url?: string; filename?: string }> }).mediaItems;
    if (mediaItems && mediaItems.length > 1) {
      handleDownloadFile(message as unknown as Parameters<typeof handleDownloadFile>[0], undefined);
    } else if (mediaItems && mediaItems.length === 1) {
      const item = mediaItems[0];
      if (item.url) handleDownloadFile(item.url, item.filename);
    } else {
      const url = (message as { FileUrl?: string; src?: string }).FileUrl || (message as { src?: string }).src;
      const name = message.FileName || (message as { name?: string }).name;
      if (url) handleDownloadFile(url, name);
    }
  };

  const items = [
    isOutgoing && {
      label: "Message Info",
      icon: <Info size={18} />,
      action: () => onMessageInfo?.(message),
    },
    removeInGroup !== 1 && {
      label: "Reply",
      icon: <Reply size={18} />,
      action: () => onReply?.(message),
    },
    isGroup && !isOutgoing && {
      label: `Message ${message.SenderInfo || "User"}`,
      icon: <User size={18} />,
      action: () => onMemberRedirect?.(message),
    },
    isText && {
      label: "Copy",
      icon: <Copy size={17} />,
      action: handleCopy,
    },
    !isText && {
      label: ((message as { AttachmentCount?: number }).AttachmentCount ?? 0) > 1 ? "Download All" : "Download",
      icon: <Download size={17} />,
      action: handleDownload,
    },
    {
      label: "Forward",
      icon: <Forward size={18} />,
      action: () => onForward?.(message),
    },
    !isDeleted && {
      label: (message as { IsStar?: 0 | 1 }).IsStar === 1 ? "Unstar" : "Star",
      icon: (
        <Star
          size={18}
          fill={(message as { IsStar?: 0 | 1 }).IsStar === 1 ? "#FFD700" : "none"}
          color={(message as { IsStar?: 0 | 1 }).IsStar === 1 ? "#FFD700" : "currentColor"}
        />
      ),
      action: () => onStar?.(message),
    },
    isOutgoing && isWithinTimeLimit && canDelete && { divider: true },
    isOutgoing && isWithinTimeLimit && isText && {
      label: "Edit",
      icon: <Edit2 size={18} />,
      action: () => onEdit?.(message),
    },
    canDelete && {
      label: "Delete",
      icon: <Trash2 size={18} />,
      danger: true,
      action: () => onDelete?.(message),
    },
  ].filter(Boolean) as Array<{
    label?: string;
    icon?: React.ReactNode;
    action?: () => void;
    divider?: boolean;
    danger?: boolean;
  }>;

  const handleClick = (action?: () => void) => {
    action?.();
    onClose();
  };

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        mouseY !== null && mouseX !== null ? { top: mouseY, left: mouseX } : undefined
      }
      onClick={(e) => e.stopPropagation()}
      transitionDuration={150}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            minWidth: 220,
            borderRadius: "16px",
            py: 0.8,
            mt: 0.5,
            backgroundColor: alpha(theme.palette.background.paper, 0.9),
            backdropFilter: "blur(12px) saturate(180%)",
            WebkitBackdropFilter: "blur(12px) saturate(180%)",
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 10px 15px -3px rgba(0,0,0,0.1), 0 20px 25px -5px rgba(0,0,0,0.1)",
            "& .MuiList-root": { padding: "6px" },
          },
        },
      }}
      transformOrigin={{ horizontal: "left", vertical: "top" }}
    >
      {items.map((item, index) =>
        item.divider ? (
          <Divider key={index} sx={{ my: 0.8, opacity: 0.6 }} />
        ) : (
          <MenuItem
            key={index}
            onClick={() => handleClick(item.action)}
            sx={{
              py: 1,
              px: 1.5,
              borderRadius: "10px",
              mb: 0.2,
              gap: 1.5,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                backgroundColor: item.danger
                  ? alpha(theme.palette.error.main, 0.08)
                  : alpha(theme.palette.primary.main, 0.08),
                color: item.danger ? theme.palette.error.main : theme.palette.primary.main,
                transform: "translateX(4px)",
                "& .MuiListItemIcon-root": {
                  color: item.danger ? theme.palette.error.main : theme.palette.primary.main,
                  transform: "scale(1.1)",
                },
              },
            }}
          >
            {item.icon && (
              <ListItemIcon
                sx={{
                  minWidth: "auto !important",
                  color: item.danger
                    ? alpha(theme.palette.error.main, 0.8)
                    : alpha(theme.palette.text.secondary, 0.8),
                  transition: "all 0.2s ease",
                }}
              >
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText
              primary={item.label}
              sx={{
                m: 0,
                "& .MuiTypography-root": {
                  fontSize: "13.5px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                },
              }}
            />
          </MenuItem>
        )
      )}
    </Menu>
  );
};

export default memo(MessageContextMenuComponent);
