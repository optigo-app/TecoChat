"use client";

import { memo } from "react";
import { Box, IconButton, useTheme, alpha } from "@mui/material";
import { Forward } from "lucide-react";
import QuickReactionMenu from "./QuickReactionMenu";
import type { ChatMessage } from "../../../types/message";

interface MessageActionsProps {
  msg: ChatMessage;
  isOutgoing: boolean;
  shouldShowActions: boolean;
  handleForward?: (msg: ChatMessage, event?: React.MouseEvent) => void;
  onEmojiSelect?: (emoji: string, msg: ChatMessage) => void;
}

const MessageActionsComponent = ({
  msg,
  isOutgoing,
  shouldShowActions,
  handleForward,
  onEmojiSelect,
}: MessageActionsProps) => {
  const theme = useTheme();

  return (
    <Box
      className="message-actions"
      sx={{
        position: "absolute",
        top: "50%",
        left: isOutgoing ? "0px" : "auto",
        right: isOutgoing ? "auto" : "0px",
        transform: `translate(${isOutgoing ? "-110%" : "110%"}, -50%)`,
        display: "flex",
        flexDirection: isOutgoing ? "row-reverse" : "row",
        alignItems: "center",
        gap: "6px",
        zIndex: 6,
        pointerEvents: "none",
        opacity: shouldShowActions ? 1 : 0,
        transition: "opacity 160ms ease, transform 160ms ease",
      }}
    >
      {!msg.IsDeletedForEveryone && handleForward && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            padding: "2px",
            borderRadius: "999px",
            backgroundColor: alpha(theme.palette.background.paper, 0.92),
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: `0 6px 14px ${alpha("#000", 0.12)}`,
            pointerEvents: "auto",
          }}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleForward(msg, e);
            }}
            sx={{
              width: 28,
              height: 28,
              color: theme.palette.text.secondary,
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
              },
            }}
          >
            <Forward size={16} />
          </IconButton>
        </Box>
      )}

      {!msg.IsDeletedForEveryone && onEmojiSelect && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            padding: "2px",
            borderRadius: "999px",
            backgroundColor: alpha(theme.palette.background.paper, 0.92),
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: `0 6px 14px ${alpha("#000", 0.12)}`,
            opacity: shouldShowActions ? 1 : 0,
            pointerEvents: shouldShowActions ? "auto" : "none",
            transition: "opacity 160ms ease, transform 160ms ease",
            transform: shouldShowActions ? "scale(1)" : "scale(0.8)",
          }}
        >
          <QuickReactionMenu
            onEmojiSelect={(emoji: string) => onEmojiSelect(emoji, msg)}
            size={16}
          />
        </Box>
      )}
    </Box>
  );
};

export default memo(MessageActionsComponent);
