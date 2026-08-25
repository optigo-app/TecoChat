"use client";

import { memo, useState, useEffect } from "react";
import { Box, Button, IconButton, Slide, Tooltip, Typography, useTheme } from "@mui/material";
import { RefreshCw, X, Sparkles } from "lucide-react";

interface UpdateNotificationProps {
  updateAvailable: boolean;
  serverVersion: string | null;
  buildTime: string | null;
  onRefresh: () => void;
  onDismiss: () => void;
}

function UpdateNotification({
  updateAvailable,
  serverVersion,
  buildTime,
  onRefresh,
  onDismiss,
}: UpdateNotificationProps) {
  const theme = useTheme();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      const t = setTimeout(() => setShow(true), 100);
      return () => clearTimeout(t);
    }
    setShow(false);
  }, [updateAvailable]);

  if (!updateAvailable) return null;

  const formattedBuildTime = buildTime
    ? new Date(buildTime).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const isDark = theme.palette.mode === "dark";

  return (
    <Slide direction="up" in={show} mountOnEnter unmountOnExit timeout={300}>
      <Box
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 10001,
          maxWidth: 420,
          minWidth: 360,
          background: isDark
            ? "linear-gradient(135deg, rgba(35,35,51,0.95) 0%, rgba(42,42,61,0.95) 100%)"
            : "linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)",
          color: isDark ? "#e0e0e8" : "#444050",
          borderRadius: "16px",
          boxShadow: isDark
            ? "0 12px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)"
            : "0 12px 40px rgba(115,103,240,0.22), 0 2px 8px rgba(0,0,0,0.06)",
          overflow: "hidden",
          border: isDark
            ? "1px solid rgba(115,103,240,0.2)"
            : "1px solid rgba(115,103,240,0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  bgcolor: "rgba(115,103,240,0.12)",
                  flexShrink: 0,
                }}
              >
                <Sparkles size={20} color="#7367f0" />
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: isDark ? "#e0e0e8" : "#444050",
                }}
              >
                A new version is available
              </Typography>
            </Box>
            <Tooltip title="Dismiss">
              <IconButton
                size="small"
                onClick={onDismiss}
                sx={{
                  color: isDark ? "rgba(224,224,232,0.4)" : "rgba(68,64,80,0.4)",
                  p: 0.5,
                  "&:hover": {
                    color: isDark ? "rgba(224,224,232,0.8)" : "rgba(68,64,80,0.8)",
                  },
                }}
              >
                <X size={18} />
              </IconButton>
            </Tooltip>
          </Box>

          <Typography
            variant="body2"
            sx={{
              fontSize: "0.875rem",
              color: isDark ? "rgba(224,224,232,0.6)" : "#7D7f85",
              mb: 0.5,
            }}
          >
            {serverVersion ? `Version ${serverVersion}` : "A newer build has been deployed."}
            {formattedBuildTime && ` · ${formattedBuildTime}`}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              fontSize: "0.8125rem",
              color: isDark ? "rgba(224,224,232,0.4)" : "#9e9ba8",
              mb: 2,
            }}
          >
            Refresh to get the latest features and fixes.
          </Typography>

          <Button
            variant="contained"
            size="medium"
            fullWidth
            onClick={onRefresh}
            startIcon={<RefreshCw size={18} />}
            sx={{
              bgcolor: "#7367f0",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.9375rem",
              borderRadius: "10px",
              py: 1,
              "&:hover": { bgcolor: "#685dd8" },
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>
    </Slide>
  );
}

export default memo(UpdateNotification);
