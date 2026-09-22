"use client";

import { memo } from "react";
import { Popover, useTheme, alpha } from "@mui/material";
import { MentionListContent, type MentionMember } from "./input/MentionDropdown";

interface AllMentionsPopoverProps {
  anchorEl: HTMLElement | null;
  groupMembers: Array<Record<string, unknown>>;
  onClose: () => void;
}

const AllMentionsPopoverComponent = ({
  anchorEl,
  groupMembers,
  onClose,
}: AllMentionsPopoverProps) => {
  const theme = useTheme();

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{
        paper: {
          sx: {
            width: 320,
            maxHeight: 320,
            borderRadius: "16px !important",
            border: "none !important",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.08) !important",
            py: 1,
            overflowY: "auto",
            "&::-webkit-scrollbar": { width: 5 },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: alpha(theme.palette.text.primary, 0.2),
              borderRadius: 3,
            },
            "&::-webkit-scrollbar-track": { background: "transparent" },
          },
        },
      }}
    >
      <MentionListContent
        members={groupMembers as MentionMember[]}
        onSelect={(member) => {
          if (member.ConversationId) {
            // Open the member's existing chat
            window.dispatchEvent(
              new CustomEvent("SELECT_CONVERSATION", {
                detail: { conversationId: member.ConversationId },
              })
            );
          } else {
            // No existing conversation — start a new chat
            window.dispatchEvent(
              new CustomEvent("SELECT_NEW_CONVERSATION", {
                detail: {
                  customer: {
                    UserId: member.UserId,
                    id: member.UserId,
                    name: member.MemberName || member.UserName || member.DisplayName,
                    UserName: member.MemberName || member.UserName || member.DisplayName,
                    MemberName: member.MemberName,
                    ProfileImageUrl: member.ProfileImage,
                    IsGroup: 0,
                  },
                },
              })
            );
          }
          onClose();
        }}
      />
    </Popover>
  );
};

export const AllMentionsPopover = memo(AllMentionsPopoverComponent);
export default AllMentionsPopover;
