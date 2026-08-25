"use client";

import React, { useRef, useEffect, useState } from "react";
import { Popper, Paper, Avatar, Box, Typography, alpha, useTheme, Skeleton } from "@mui/material";
import { Users as UsersIcon } from "lucide-react";
import { getWhatsAppAvatarConfig } from "../../../utils/globalFunc";

export interface MentionMember {
  UserId?: string | number;
  MemberName?: string;
  UserName?: string;
  DisplayName?: string;
  ProfileImage?: string;
  ConversationId?: string | number;
}

// ── Reusable list content (used by both editor dropdown and @all popover) ─────

interface MentionListContentProps {
  members: MentionMember[];
  selectedIndex?: number;
  onSelect: (member: MentionMember) => void;
  isLoading?: boolean;
  showAllItem?: boolean;
}

export const MentionListContent: React.FC<MentionListContentProps> = ({
  members,
  selectedIndex = -1,
  onSelect,
  isLoading = false,
  showAllItem = false,
}) => {
  const theme = useTheme();

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, i) => (
          <Box
            key={`skeleton-${i}`}
            sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25 }}
          >
            <Skeleton variant="circular" width={36} height={36} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="70%" height={18} />
            </Box>
          </Box>
        ))}
      </>
    );
  }

  return (
    <>
      {members.map((member, idx) => {
        const name = member.MemberName || member.UserName || member.DisplayName || "User";
        const isAll = String(member.UserId) === "all";
        const isSelected = idx === selectedIndex;
        const avatarConfig = !isAll ? getWhatsAppAvatarConfig(name, 36) : null;
        return (
          <Box
            key={member.UserId || idx}
            data-mention-idx={idx}
            onClick={() => onSelect(member)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.75,
              px: 2,
              py: 1.25,
              cursor: "pointer",
              borderRadius: "8px",
              mx: 1,
              backgroundColor: isSelected
                ? alpha(theme.palette.primary.main, 0.08)
                : "transparent",
              transition: "background-color 0.12s ease",
              "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
              },
            }}
          >
            {/* Avatar */}
            {isAll ? (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: alpha(theme.palette.text.primary, 0.08),
                  color: theme.palette.text.secondary,
                  flexShrink: 0,
                }}
              >
                <UsersIcon size={18} />
              </Box>
            ) : (
              <Avatar
                {...avatarConfig}
                src={member.ProfileImage}
                sx={{
                  ...avatarConfig?.sx,
                  flexShrink: 0,
                }}
              />
            )}

            {/* Name + subtitle */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: isSelected ? 600 : 500,
                  color: theme.palette.text.primary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.3,
                }}
              >
                {name}
              </Typography>
              {isAll && (
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    color: theme.palette.text.secondary,
                    lineHeight: 1.2,
                    mt: 0.25,
                  }}
                >
                  Mention all members
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </>
  );
};

// ── Shared paper styling ──────────────────────────────────────────────────────

const usePaperSx = () => {
  const theme = useTheme();
  return {
    width: 320,
    maxHeight: 400,
    overflowY: "auto" as const,
    borderRadius: "16px !important",
    border: "none !important",
    backgroundColor: theme.palette.background.paper,
    py: 1,
    animation: "mentionDropdownIn 0.15s ease-out",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.08) !important",
    "&::-webkit-scrollbar": { width: 5 },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: alpha(theme.palette.text.primary, 0.2),
      borderRadius: 3,
    },
    "&::-webkit-scrollbar-track": { background: "transparent" },
  };
};

// ── Editor dropdown (anchored to cursor via virtual element + Popper) ─────────

interface MentionDropdownProps {
  members: MentionMember[];
  selectedIndex: number;
  onSelect: (member: MentionMember) => void;
  onClose: () => void;
  position: { top: number; left: number };
  visible: boolean;
  isLoading?: boolean;
}

const MentionDropdown: React.FC<MentionDropdownProps> = ({
  members,
  selectedIndex,
  onSelect,
  onClose,
  position,
  visible,
  isLoading = false,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const virtualEl = document.createElement("div");
    virtualEl.style.position = "fixed";
    virtualEl.style.top = `${position.top}px`;
    virtualEl.style.left = `${position.left}px`;
    virtualEl.style.width = "0";
    virtualEl.style.height = "0";
    virtualEl.style.pointerEvents = "none";
    document.body.appendChild(virtualEl);
    setAnchorEl(virtualEl);
    return () => {
      document.body.removeChild(virtualEl);
    };
  }, [visible, position.top, position.left]);

  useEffect(() => {
    if (!visible || !listRef.current) return;
    const selectedEl = listRef.current.querySelector(
      `[data-mention-idx="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, visible]);

  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (listRef.current && !listRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  const paperSx = usePaperSx();

  if (!visible || (!anchorEl && !isLoading)) return null;
  if (members.length === 0 && !isLoading) return null;

  return (
    <Popper
      open={visible}
      anchorEl={anchorEl}
      placement="top-start"
      modifiers={[
        { name: "flip", enabled: true, options: { fallbackPlacements: ["bottom-start"] } },
        { name: "offset", options: { offset: [0, 8] } },
        { name: "preventOverflow", enabled: true, options: { padding: 8 } },
      ]}
      style={{ zIndex: 1300 }}
    >
      <Paper ref={listRef} elevation={0} sx={paperSx}>
        <MentionListContent
          members={members}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          isLoading={isLoading}
        />
      </Paper>
    </Popper>
  );
};

export default React.memo(MentionDropdown);
