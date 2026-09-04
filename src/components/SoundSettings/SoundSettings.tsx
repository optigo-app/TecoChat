"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Switch,
  Box,
  Typography,
  IconButton,
  useTheme,
  alpha,
} from "@mui/material";
import { Volume2, Bell, Eye, X } from "lucide-react";
import { useSoundSettings } from "../../hooks/useSoundSettings";

interface SoundSettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function SoundSettings({ open, onClose }: SoundSettingsProps) {
  const theme = useTheme();
  const { settings, update } = useSoundSettings();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            bgcolor: theme.palette.background.paper,
            backgroundImage: "none",
            boxShadow: theme.palette.mode === "dark"
              ? "0 20px 60px rgba(0,0,0,0.6)"
              : "0 20px 60px rgba(0,0,0,0.2)",
            border: theme.palette.mode === "dark"
              ? `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
              : "none",
          },
        },
        backdrop: {
          sx: {
            bgcolor: theme.palette.mode === "dark"
              ? "rgba(10,10,20,0.7)"
              : "rgba(0,0,0,0.5)",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: "1.1rem",
          color: theme.palette.text.primary,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          pb: 1,
        }}
      >
        <Volume2 size={22} color={theme.palette.primary.main} />
        Notifications
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ ml: "auto", color: theme.palette.text.secondary }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {/* Sounds toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            py: 1.5,
            px: 1.5,
            borderRadius: 2,
            mb: 1,
            transition: "background 0.15s ease",
            "&:hover": {
              bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.06 : 0.03),
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              mr: 1.5,
              flexShrink: 0,
            }}
          >
            <Volume2 size={20} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 500, fontSize: "0.9rem", color: theme.palette.text.primary }}>
              Sounds
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: theme.palette.text.secondary }}>
              Play sound for incoming and outgoing messages
            </Typography>
          </Box>
          <Switch
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            size="small"
          />
        </Box>

        {/* Notification toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            py: 1.5,
            px: 1.5,
            borderRadius: 2,
            mb: 1,
            transition: "background 0.15s ease",
            "&:hover": {
              bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.06 : 0.03),
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              mr: 1.5,
              flexShrink: 0,
            }}
          >
            <Bell size={20} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 500, fontSize: "0.9rem", color: theme.palette.text.primary }}>
              Desktop Notifications
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: theme.palette.text.secondary }}>
              Show browser notifications for new messages
            </Typography>
          </Box>
          <Switch
            checked={settings.notification}
            onChange={(e) => update({ notification: e.target.checked })}
            size="small"
          />
        </Box>

        {/* Message preview toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            py: 1.5,
            px: 1.5,
            borderRadius: 2,
            transition: "background 0.15s ease",
            "&:hover": {
              bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.06 : 0.03),
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              mr: 1.5,
              flexShrink: 0,
            }}
          >
            <Eye size={20} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 500, fontSize: "0.9rem", color: theme.palette.text.primary }}>
              Message Preview
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: theme.palette.text.secondary }}>
              Show sender name and message text in notifications
            </Typography>
          </Box>
          <Switch
            checked={settings.send}
            onChange={(e) => update({ send: e.target.checked })}
            size="small"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button
          onClick={onClose}
          variant="text"
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
            px: 2,
            py: 0.75,
            color: theme.palette.text.secondary,
            "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.08) },
          }}
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
