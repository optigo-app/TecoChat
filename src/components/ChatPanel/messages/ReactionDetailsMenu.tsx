"use client";

import { memo, useMemo, useState } from "react";
import {
  Menu,
  MenuItem,
  Box,
  Typography,
  Divider,
  Chip,
  useTheme,
  alpha,
} from "@mui/material";
import { Emoji, EmojiStyle } from "emoji-picker-react";
import { charToUnified } from "../../../utils/EmojiUtils";

interface ReactionUser {
  Id?: string | number;
  UserId?: number | string;
  Emoji?: string;
  Reaction?: string;
  UserName?: string;
  Direction?: number;
}

interface ReactionDetailsMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  reactions: ReactionUser[];
  currentUserId?: number | string;
  disablePortal?: boolean;
  onRemoveReaction?: (reaction: ReactionUser) => void;
}

const ReactionDetailsMenuComponent = ({
  anchorEl,
  onClose,
  reactions,
  currentUserId,
  disablePortal = false,
  onRemoveReaction,
}: ReactionDetailsMenuProps) => {
  const theme = useTheme();
  const open = Boolean(anchorEl);
  const [filter, setFilter] = useState<string>("all");

  const reactionGroups = useMemo(() => {
    const groups: Record<string, ReactionUser[]> = {};
    reactions.forEach((r) => {
      const emoji = r.Emoji || r.Reaction || "";
      if (!groups[emoji]) groups[emoji] = [];
      groups[emoji].push(r);
    });
    return groups;
  }, [reactions]);

  const filteredReactions = useMemo(() => {
    const list = filter === "all" ? reactions : reactionGroups[filter] || [];
    return [...list].sort((a, b) => {
      const aIsMe = String(a.UserId) === String(currentUserId);
      const bIsMe = String(b.UserId) === String(currentUserId);
      if (aIsMe) return -1;
      if (bIsMe) return 1;
      return 0;
    });
  }, [filter, reactions, reactionGroups, currentUserId]);

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      disablePortal={disablePortal}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
      transitionDuration={350}
      slotProps={{
        paper: {
          sx: {
            width: 320,
            borderRadius: 3,
            maxHeight: 400,
            zIndex: 11030,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            backdropFilter: "blur(8px)",
            backgroundColor: theme.palette.mode === "dark" ? "rgba(35,35,51,0.95)" : "rgba(255,255,255,0.95)",
          },
        },
      }}
    >
      {/* Emoji filters */}
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            overflowX: "auto",
            pb: 0.5,
            "&::-webkit-scrollbar": { display: "none" },
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <Chip
            label={`All ${reactions.length}`}
            size="small"
            clickable
            color={filter === "all" ? "primary" : "default"}
            onClick={() => setFilter("all")}
            sx={{ transition: "all 0.2s", borderRadius: "8px" }}
          />
          {Object.entries(reactionGroups).map(([emoji, group]) => {
            const unified = charToUnified(emoji);
            return (
              <Chip
                key={emoji}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {unified ? <Emoji unified={unified} size={16} emojiStyle={EmojiStyle.APPLE} /> : emoji}
                    <Typography variant="body2">{group.length}</Typography>
                  </Box>
                }
                size="small"
                clickable
                color={filter === emoji ? "primary" : "default"}
                onClick={() => setFilter(emoji)}
                sx={{ transition: "all 0.2s", borderRadius: "8px", px: 0.5 }}
              />
            );
          })}
        </Box>
      </Box>

      <Divider />

      {/* User list */}
      <Box sx={{ maxHeight: 240, overflowY: "auto", py: 1, px: 1 }}>
        {filteredReactions.map((r, i) => {
          const isCurrentUser = String(r.UserId) === String(currentUserId);
          const emojiValue = r.Emoji || r.Reaction || "";

          return (
            <MenuItem
              key={r.Id || i}
              onClick={isCurrentUser && onRemoveReaction ? () => onRemoveReaction(r) : undefined}
              sx={{
                cursor: isCurrentUser ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.2,
                px: 1.5,
                mb: 0.5,
                borderRadius: "12px",
                transition: "all 0.2s ease",
                overflow: "hidden",
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  transform: "translateX(4px)",
                },
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: isCurrentUser ? 600 : 400 }}>
                  {isCurrentUser ? "You" : r.UserName || "User"}
                </Typography>
                {isCurrentUser && (
                  <Typography variant="caption" color="text.secondary">
                    Tap to remove
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {(() => {
                  const unified = charToUnified(emojiValue);
                  return unified ? (
                    <Emoji unified={unified} size={20} emojiStyle={EmojiStyle.APPLE} />
                  ) : (
                    <Typography sx={{ fontSize: 18 }}>{emojiValue}</Typography>
                  );
                })()}
              </Box>
            </MenuItem>
          );
        })}
        {filteredReactions.length === 0 && (
          <MenuItem disabled>
            <Typography color="text.secondary">No reactions</Typography>
          </MenuItem>
        )}
      </Box>
    </Menu>
  );
};

export default memo(ReactionDetailsMenuComponent);
