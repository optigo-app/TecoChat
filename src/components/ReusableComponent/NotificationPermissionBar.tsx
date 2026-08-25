"use client";

// Ported from OldChatReactCode/src/components/_ui/NotificationPermissionBar.js
// Shows a banner at the top of the conversation list prompting the user to
// enable desktop notifications. Disappears when permission is granted or
// the user dismisses it. Includes a ringing bell animation.

import { useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { Bell, X } from "lucide-react";
import { useNotificationManager } from "../../contexts/NotificationContext";

export const NotificationPermissionBar = () => {
  const { permissionStatus, requestPermission } = useNotificationManager();
  const [dismissed, setDismissed] = useState(false);

  // Show if default OR denied (so we can guide them to unblock)
  if (permissionStatus === "granted" || dismissed) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: "12px 16px",
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
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          flexShrink: 0,
          // Bell ring animation
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
        <Bell size={20} />
      </Box>

      <Box sx={{ flexGrow: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{ color: "var(--color-title)", fontWeight: 500 }}
        >
          Get notified of new messages
        </Typography>
        <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
          Turn on desktop notifications
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          onClick={requestPermission}
          size="small"
          sx={{
            color: "var(--color-primary)",
            fontWeight: 600,
            textTransform: "none",
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
            "&:hover": {
              backgroundColor: "var(--color-hover-bg-strong)",
            },
          }}
        >
          <X size={18} />
        </Box>
      </Box>
    </Box>
  );
};

export default NotificationPermissionBar;
