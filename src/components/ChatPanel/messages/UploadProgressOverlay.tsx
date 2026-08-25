"use client";

import { memo } from "react";
import { Box, CircularProgress, Typography, useTheme, alpha } from "@mui/material";

interface UploadProgressOverlayProps {
  percent: number;
  size?: number;
}

const UploadProgressOverlayComponent = ({
  percent,
  size = 52,
}: UploadProgressOverlayProps) => {
  const theme = useTheme();
  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent || 0)));

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: alpha("#000", 0.45),
        backdropFilter: "blur(2px)",
        zIndex: 5,
        borderRadius: "inherit",
      }}
    >
      <Box sx={{ position: "relative", display: "inline-flex" }}>
        <CircularProgress
          variant="determinate"
          value={clampedPercent}
          size={size}
          thickness={3}
          sx={{
            color: "#fff",
            "& .MuiCircularProgress-circle": {
              strokeLinecap: "round",
            },
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "#fff",
              fontSize: size < 48 ? 10 : 12,
              fontWeight: 600,
            }}
          >
            {clampedPercent}%
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(UploadProgressOverlayComponent);
