"use client";

import { memo } from "react";
import { Box, Typography, Avatar, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { getWhatsAppAvatarConfig, getSoftAvatarColors } from "../../../../utils/globalFunc";
import type { TypingStatus } from "../../../../types/message";

interface TypingIndicatorProps {
  typingStatus: TypingStatus | null;
  isGroup?: boolean;
}

const TypingIndicatorComponent = ({ typingStatus, isGroup }: TypingIndicatorProps) => {
  const theme = useTheme();
  if (!typingStatus) return null;

  const userName = typingStatus.UserName || "Someone";
  const profileImage = typingStatus.ProfileImageUrl || typingStatus.ProfileImage;
  const avatarConfig = getWhatsAppAvatarConfig(userName, 38);
  const senderColor = theme.palette.mode === "dark"
    ? getSoftAvatarColors(userName).fgDark
    : getSoftAvatarColors(userName).fg;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        animation: "fadeIn 0.3s ease-out",
        "@keyframes fadeIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      {isGroup && (
        <Avatar
          src={profileImage || undefined}
          sx={{ ...avatarConfig.sx, width: 38, height: 38, fontSize: 38 * 0.4 }}
        >
          {avatarConfig.children}
        </Avatar>
      )}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          backgroundColor: theme.palette.background.paper,
          padding: "8px 12px",
          borderRadius: "12px 12px 12px 4px",
          boxShadow: `0 2px 8px ${alpha("#000", 0.08)}`,
          maxWidth: "fit-content",
        }}
      >
        {isGroup && (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: senderColor,
              fontSize: "0.75rem",
              mb: 0.2,
            }}
          >
            {userName}
          </Typography>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, height: "14px" }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor: isGroup ? senderColor : theme.palette.text.secondary,
                opacity: 0.4,
                animation: "typingDot 1.4s infinite ease-in-out",
                animationDelay: `${i * 0.2}s`,
                "@keyframes typingDot": {
                  "0%, 100%": { transform: "scale(1)", opacity: 0.4 },
                  "50%": { transform: "scale(1.4)", opacity: 1 },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(TypingIndicatorComponent);
