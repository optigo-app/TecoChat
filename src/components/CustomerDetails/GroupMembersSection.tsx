"use client";

import { useState } from "react";
import { Typography, Box, Skeleton } from "@mui/material";
import { ConversationAvatar } from "../ConversationAvatar/ConversationAvatar";
import { Search, UserPlus, ChevronDown, Clock } from "lucide-react";

interface GroupPermissionsData {
  addOtherMembers?: boolean;
  [key: string]: boolean | undefined;
}

interface GroupMember {
  UserId?: string | number;
  Name?: string;
  DisplayEmail?: string;
  About?: string;
  IsAdmin?: number | boolean;
  ProfileImageUrl?: string;
  [key: string]: unknown;
}

interface GroupMembersSectionProps {
  members?: GroupMember[];
  isCurrentUserAdmin: boolean | undefined;
  auth: any;
  onAddMemberClick: () => void;
  onSearchClick: () => void;
  onMemberClick: (event: React.MouseEvent, member: GroupMember) => void;
  showAllMembers: boolean;
  setShowAllMembers: (show: boolean) => void;
  groupPermissions?: GroupPermissionsData;
  onPastParticipantsClick?: () => void;
  isPastParticipant?: number;
  loading?: boolean;
}

const GroupMembersSection = ({
  members = [],
  isCurrentUserAdmin,
  auth,
  onAddMemberClick,
  onSearchClick,
  onMemberClick,
  showAllMembers,
  setShowAllMembers,
  groupPermissions,
  onPastParticipantsClick,
  isPastParticipant = 0,
  loading = false,
}: GroupMembersSectionProps) => {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | number | null>(null);
  const canAddMembers = isCurrentUserAdmin || groupPermissions?.addOtherMembers;

  const visibleMembers = showAllMembers ? members : members.slice(0, 10);
  const hasMoreMembers = members.length > 10;
  const currentAuthId = auth?.id || auth?.userId;

  if (loading) {
    return (
      <div className="info-block members-block">
        <div className="block-header">
          <Skeleton variant="text" width={120} height={20} />
        </div>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.5 }}>
              <Skeleton variant="circular" width={42} height={42} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="40%" height={16} />
              </Box>
            </Box>
          ))}
        </Box>
      </div>
    );
  }

  return (
    <div className="info-block members-block">
      <div className="block-header">
        <Typography className="block-label">{members.length} participants</Typography>
        <Search
          size={16}
          className="block-header-search"
          style={{ color: "var(--color-text-secondary)", cursor: "pointer" }}
          onClick={onSearchClick}
        />
      </div>

      <div className="settings-list members-list">
        {canAddMembers && (
          <div
            className="setting-item no-border member-item add-member-row"
            onClick={onAddMemberClick}
          >
            <div className="setting-left">
              <div className="action-circle-small add-member-circle">
                <UserPlus size={20} color="#fff" />
              </div>
              <span className="member-name action-text">Add members</span>
            </div>
          </div>
        )}

        {visibleMembers?.map((member, idx) => (
          <div
            key={member.UserId || idx}
            className={`setting-item no-border member-item ${
              member.UserId !== currentAuthId ? "clickable-member" : ""
            }`}
            onClick={(e) => onMemberClick(e, member)}
            onContextMenu={(e) => onMemberClick(e, member)}
            onMouseEnter={() => setHoveredMemberId(member.UserId as any)}
            onMouseLeave={() => setHoveredMemberId(null)}
            style={{
              cursor:
                isCurrentUserAdmin && member.UserId !== currentAuthId ? "pointer" : "default",
            }}
          >
            <div className="setting-left">
              <ConversationAvatar
                member={
                  {
                    ...member,
                    name: member.Name || "User",
                    ProfileImageUrl: member.ProfileImageUrl,
                  } as any
                }
                size={42}
              />
              <div className="text-stack" style={{ flex: 1 }}>
                <div
                  className="member-name-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <span className="member-name">{member.Name || "User"}</span>
                  {member.IsAdmin && <div className="admin-badge">Group Admin</div>}
                </div>
                <div
                  className="member-id-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <Typography variant="caption" className="sub-text">
                    {member.DisplayEmail ?? ""}
                  </Typography>
                  {isCurrentUserAdmin && member.UserId !== currentAuthId && (
                    <ChevronDown
                      size={18}
                      className={`member-chevron ${
                        hoveredMemberId === member.UserId ? "visible" : ""
                      }`}
                      style={{
                        color: "var(--color-text-secondary)",
                        opacity: hoveredMemberId === member.UserId ? 1 : 0,
                        transition: "opacity 0.2s",
                      }}
                    />
                  )}
                </div>
                {member.About && (
                  <Typography variant="caption" className="sub-text">
                    {member.About}
                  </Typography>
                )}
              </div>
            </div>
            <div className="member-right-actions" />
          </div>
        ))}

        {hasMoreMembers && (
          <div
            className="setting-item no-border view-all-btn"
            onClick={() => setShowAllMembers(!showAllMembers)}
          >
            <div className="setting-left" style={{ justifyContent: "center" }}>
              <Typography sx={{ color: "primary.main", fontSize: "14px", fontWeight: 500 }}>
                {showAllMembers ? "Show less" : `View ${members.length - 10} more`}
              </Typography>
            </div>
          </div>
        )}

        {isPastParticipant > 0 && (
          <div
            className="setting-item no-border member-item add-member-row"
            onClick={onPastParticipantsClick}
            style={{ marginTop: "5px" }}
          >
            <div className="setting-left">
              <div
                className="action-circle-small"
                style={{
                  backgroundColor: "var(--color-hover-bg)",
                  color: "var(--color-text-2nd)",
                }}
              >
                <Clock size={20} />
              </div>
              <span
                className="member-name action-text"
                style={{ color: "var(--color-text-2nd)" }}
              >
                Past participants
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupMembersSection;
