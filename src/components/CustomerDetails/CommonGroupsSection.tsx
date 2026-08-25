"use client";

import { useEffect, useState } from "react";
import { Typography, Box, Skeleton, Avatar } from "@mui/material";
import { getWhatsAppAvatarConfig } from "../../utils/globalFunc";
import { CommonGroupListApi } from "../../API/Groups/CommonGroupListApi";

const INITIAL_LIMIT = 10;

interface CommonGroupsSectionProps {
  customer: any;
  auth: any;
  open: boolean;
}

const CommonGroupsSection = ({ customer, auth, open }: CommonGroupsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchCommonGroups = async () => {
      if (!open || !customer?.ConversationId) return;
      setLoading(true);
      try {
        const response = await CommonGroupListApi(auth, {
          userId: (customer.ReceiverId || customer.id) ?? "",
          conversationId: customer.ConversationId ?? "",
        });

        if (response?.Status === "200" || response?.success) {
          if (response?.Data?.rd?.length > 0) {
            const fetchedGroups = response?.Data?.rd || response?.rd || [];
            setGroups(fetchedGroups);
          } else {
            setGroups([]);
          }
        } else {
          setGroups([]);
        }
      } catch (error) {
        console.error("Error fetching common groups:", error);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCommonGroups();
  }, [customer?.ConversationId, customer?.ReceiverId, customer?.UserId, customer?.id, auth, open]);

  const handleGroupClick = (group: any) => {
    window.dispatchEvent(
      new CustomEvent("SELECT_CONVERSATION", {
        detail: { conversationId: group.ConversationId },
      })
    );
  };

  const renderMembersPreview = (membersStr: string) => {
    if (!membersStr) return "No members";

    try {
      const membersList = JSON.parse(membersStr);

      const names = membersList.map((m: any) => {
        const id = m.UserId || m.Id || m.id;
        const authId = auth?.id || auth?.userId;

        return Number(id) === Number(authId)
          ? "You"
          : m.UserName || m.MemberName || "User";
      });

      const youIndex = names.findIndex((n: string) => n === "You");
      if (youIndex > 0) {
        names.splice(youIndex, 1);
        names.unshift("You");
      }

      return names.join(", ");
    } catch (e) {
      console.error("Error parsing CommonGroups members:", e);
      return "Unknown members";
    }
  };

  const visibleGroups = showAll ? groups : groups.slice(0, INITIAL_LIMIT);

  if (loading) {
    return (
      <div
        className="info-block contact-info-block"
        style={{ marginTop: "8px", borderTop: "none", borderBottom: "none" }}
      >
        <Typography sx={{ color: "var(--color-text-secondary)", fontSize: "14px", fontWeight: 500, mb: 1 }}>
          Groups in common
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5, ml: -1.5, mr: -1.5 }}>
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Skeleton variant="circular" width={48} height={48} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width={120} height={20} />
                <Skeleton variant="text" width={80} height={16} />
              </Box>
            </Box>
          ))}
        </Box>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return null;
  }

  return (
    <div
      className="info-block contact-info-block"
      style={{ marginTop: "8px", borderTop: "none", borderBottom: "none" }}
    >
      <Typography sx={{ color: "var(--color-text-secondary)", fontSize: "14px", fontWeight: 500, mb: 1 }}>
        {groups.length} group{groups.length !== 1 ? "s" : ""} in common
      </Typography>
      {groups?.length > 0 && (
        <>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {visibleGroups.map((group) => (
              <Box
                key={group.ConversationId}
                onClick={() => handleGroupClick(group)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 1.5,
                  ml: -1.5,
                  mr: -1.5,
                  cursor: "pointer",
                  borderRadius: "8px",
                  "&:hover": {
                    backgroundColor: "var(--color-hover-bg)",
                  },
                }}
              >
                <Avatar
                  {...getWhatsAppAvatarConfig(group.Name || "Group", 48)}
                  src={group.ProfileUrl}
                />

                <Box sx={{ flex: 1, overflow: "hidden" }}>
                  <Typography
                    sx={{
                      fontSize: "16px",
                      color: "var(--color-title)",
                      fontWeight: 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {group.Name || ""}
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: "14px",
                      color: "var(--color-text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      mt: 0.2,
                    }}
                  >
                    {renderMembersPreview(group.Members)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {groups.length > INITIAL_LIMIT && (
            <Box sx={{ textAlign: "center", mt: 1 }}>
              <Typography
                onClick={() => setShowAll((prev) => !prev)}
                sx={{
                  fontSize: "14px",
                  cursor: "pointer",
                  color: "primary.main",
                  fontWeight: 500,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {showAll ? "Show less" : `Show ${groups.length - INITIAL_LIMIT} more`}
              </Typography>
            </Box>
          )}
        </>
      )}
    </div>
  );
};

export default CommonGroupsSection;
