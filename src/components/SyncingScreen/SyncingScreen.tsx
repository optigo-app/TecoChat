"use client";

import { Box, Typography, LinearProgress, useTheme, alpha } from "@mui/material";
import Image from "next/image";
import logo from "@/src/assets/logo.png";

/**
 * WhatsApp-like full-screen "syncing" overlay shown while the initial
 * PreLoadConversation API call is in flight (no cached data available).
 * Displays the app logo, app name, an indeterminate progress bar, and a
 * status message.
 */
const SyncingScreen = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        background: isDark
          ? "linear-gradient(160deg, #161622 0%, #303045 100%)"
          : "linear-gradient(160deg, #f5f5f5 0%, #ffffff 100%)",
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          width: { xs: 72, sm: 80 },
          height: { xs: 72, sm: 80 },
          borderRadius: "20px",
          overflow: "hidden",
          flexShrink: 0,
          boxShadow: `0 4px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
          position: "relative",
        }}
      >
        <Image
          src={logo}
          alt="TeCoChat"
          fill
          style={{ objectFit: "cover" }}
          priority
          sizes="80px"
        />
      </Box>

      {/* App name */}
      <Typography
        sx={{
          fontSize: "clamp(1.25rem, 2vw + 0.5rem, 1.5rem)",
          fontWeight: 700,
          color: "text.primary",
          letterSpacing: "-0.025em",
          fontFamily: "var(--font-family)",
        }}
      >
        TeCoChat
      </Typography>

      {/* Progress bar + status text */}
      <Box
        sx={{
          width: { xs: 200, sm: 240 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <LinearProgress
          sx={{
            width: "100%",
            height: 4,
            borderRadius: 2,
            "& .MuiLinearProgress-bar": {
              borderRadius: 2,
            },
          }}
        />
        <Typography
          sx={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "text.secondary",
            fontFamily: "var(--font-family)",
          }}
        >
          Syncing your conversations...
        </Typography>
      </Box>
    </Box>
  );
};

export default SyncingScreen;
