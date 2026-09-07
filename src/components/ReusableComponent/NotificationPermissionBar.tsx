"use client";

// Ported from OldChatReactCode/src/components/_ui/NotificationPermissionBar.js
// Shows a banner at the top of the conversation list prompting the user to
// enable desktop notifications. Disappears when permission is granted or
// the user dismisses it. Includes a ringing bell animation.
// Responsive: compact on mobile (xs), full on sm+.

import { useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { Bell, X } from "lucide-react";
import { useNotificationManager } from "../../contexts/NotificationContext";
import { useIsMobile } from "../../hooks/useIsMobile";

export const NotificationPermissionBar = () => {
  const { permissionStatus, requestPermission } = useNotificationManager();
  const [dismissed, setDismissed] = useState(false);
  const isMobile = useIsMobile();

  // Show if default OR denied (so we can guide them to unblock)
  if (permissionStatus === "granted" || dismissed) {
    return null;
  }

  const bellSize = isMobile ? 16 : 20;
  const iconSize = isMobile ? 16 : 18;
  const avatarSize = isMobile ? 32 : 40;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 1 : 2,
        p: isMobile ? "10px 12px" : "12px 16px",
        backgroundColor: "var(--color-hover-bg)",
        borderBottom: "1px solid var(--color-border)",
        animation: "slideDown 0.3s ease-out",
        "@keyframes slideDown": {
          from: { transform: "translateY(-100%)", opacity: 0 },
          to: { transform: "translateY(0)", opacity: 1 },
        },
      }}
    >
      <Box
        sx={{
          backgroundColor: "var(--color-primary)",
          borderRadius: "50%",
          width: avatarSize,
          height: avatarSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          flexShrink: 0,
          "& svg": {
            animation: "bellRing 2s ease-in-out infinite",
            transformOrigin: "top center",
          },
          "@keyframes bellRing": {
            "0%, 100%": { transform: "rotate(0deg)" },
            "10%": { transform: "rotate(14deg)" },
            "20%": { transform: "rotate(-14deg)" },
            "30%": { transform: "rotate(12deg)" },
            "40%": { transform: "rotate(-12deg)" },
            "50%": { transform: "rotate(10deg)" },
            "60%": { transform: "rotate(-10deg)" },
            "70%": { transform: "rotate(8deg)" },
            "80%": { transform: "rotate(-8deg)" },
            "90%": { transform: "rotate(0deg)" },
          },
        }}
      >
        <Bell size={bellSize} />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: "var(--color-title)",
            fontWeight: 500,
            fontSize: isMobile ? "0.8125rem" : "0.875rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {isMobile ? "Enable notifications" : "Get notified of new messages"}
        </Typography>
        {!isMobile && (
          <Typography
            variant="caption"
            sx={{ color: "var(--color-text-secondary)" }}
          >
            Turn on desktop notifications
          </Typography>
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        <Button
          onClick={requestPermission}
          size="small"
          sx={{
            color: "var(--color-primary)",
            fontWeight: 600,
            textTransform: "none",
            fontSize: isMobile ? "0.75rem" : "0.8125rem",
            minWidth: "auto",
            px: isMobile ? 1 : 1.5,
            py: 0.25,
            "&:hover": {
              backgroundColor: "var(--color-hover-bg-strong)",
            },
          }}
        >
          Turn on
        </Button>
        <Box
          onClick={() => setDismissed(true)}
          sx={{
            cursor: "pointer",
            color: "var(--color-text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 0.5,
            borderRadius: "50%",
            flexShrink: 0,
            "&:hover": {
              backgroundColor: "var(--color-hover-bg-strong)",
            },
          }}
        >
          <X size={iconSize} />
        </Box>
      </Box>
    </Box>
  );
};

export default NotificationPermissionBar;
