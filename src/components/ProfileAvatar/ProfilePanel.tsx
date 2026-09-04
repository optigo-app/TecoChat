"use client";

import { useState, useEffect } from "react";
import { Box, Typography, IconButton, Avatar, Skeleton, Divider, alpha, useTheme } from "@mui/material";
import { ArrowLeft, Bell, Volume2, Eye, ChevronRight } from "lucide-react";
import { useLoginContext } from "../../context/LoginData";
import { getWhatsAppAvatarConfig, isImageDead, markImageAsDead } from "../../utils/globalFunc";
import { useIsMobile } from "@/src/hooks/useIsMobile";
import { useSoundSettings } from "../../hooks/useSoundSettings";
import IOSSwitch from "../ReusableComponent/IOSSwitch";
import "./ProfilePanel.scss";

type PanelView = "profile" | "notifications";

interface ProfilePanelProps {
  onBack: () => void;
}

const isValidUrl = (url: unknown): url is string => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed !== "" && trimmed !== "null" && trimmed !== "undefined";
};

const ProfilePanel = ({ onBack }: ProfilePanelProps) => {
  const theme = useTheme();
  const { auth } = useLoginContext();
  const isMobile = useIsMobile();
  const { settings, update } = useSoundSettings();
  const [view, setView] = useState<PanelView>("profile");

  // Avatar size: 120px on mobile, 160px on desktop
  const avatarSize = isMobile ? 120 : 160;
  const avatarConfig = getWhatsAppAvatarConfig(auth?.username, avatarSize);

  const rawImageUrl = auth?.ProfileImageUrl as string | undefined;
  const imageUrl = isValidUrl(rawImageUrl) && !isImageDead(rawImageUrl) ? rawImageUrl : null;
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(
    imageUrl ? "loading" : "error"
  );

  useEffect(() => {
    if (imageUrl) {
      setImageState("loading");
      const img = new window.Image();
      img.src = imageUrl;
      if (img.complete) setImageState("loaded");
    } else {
      setImageState("error");
    }
  }, [imageUrl]);

  const handleLoad = () => setImageState("loaded");
  const handleError = () => {
    if (imageUrl) markImageAsDead(imageUrl);
    setImageState("error");
  };

  // ── Settings row component ──
  const SettingRow = ({
    icon,
    label,
    description,
    checked,
    onChange,
  }: {
    icon: React.ReactNode;
    label: string;
    description: string;
    checked: boolean;
    onChange: (val: boolean) => void;
  }) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        minHeight: 56,
        py: 1,
        px: 2,
        borderRadius: 2,
        mx: 1.5,
        my: 0.5,
        transition: "background 0.15s ease",
        "&:hover": {
          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.06 : 0.03),
        },
      }}
    >
      {/* Left icon — fixed width for consistent alignment */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "50%",
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          color: theme.palette.primary.main,
          mr: 2,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      {/* Center text — flex 1, takes remaining space */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500, fontSize: "0.9rem", color: theme.palette.text.primary, lineHeight: 1.3 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: theme.palette.text.secondary, lineHeight: 1.3, mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
      {/* Right switch — fixed width, consistent alignment, Apple-style */}
      <Box sx={{ flexShrink: 0, ml: 2, display: "flex", alignItems: "center" }}>
        <IOSSwitch
          checked={checked}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
      </Box>
    </Box>
  );

  // ── Notifications view ──
  if (view === "notifications") {
    return (
      <Box className="profile-panel-overlay">
        <Box className="profile-panel-header">
          <IconButton onClick={() => setView("profile")} className="back-btn" size="small">
            <ArrowLeft size={24} />
          </IconButton>
          <Typography variant="h6" className="header_title">
            Notifications
          </Typography>
        </Box>

        <Box className="profile-panel-body" sx={{ pt: 2 }}>
          <SettingRow
            icon={<Volume2 size={20} />}
            label="Sounds"
            description="Play sound for incoming and outgoing messages"
            checked={settings.enabled}
            onChange={(val) => update({ enabled: val })}
          />
          <Divider
            sx={{
              borderColor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.08)",
              mx: 2,
            }}
          />
          <SettingRow
            icon={<Bell size={20} />}
            label="Desktop Notifications"
            description="Show browser notifications for new messages"
            checked={settings.notification}
            onChange={(val) => update({ notification: val })}
          />
          <Divider
            sx={{
              borderColor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.08)",
              mx: 2,
            }}
          />
          <SettingRow
            icon={<Eye size={20} />}
            label="Message Preview"
            description="Show sender name and message text in notifications"
            checked={settings.send}
            onChange={(val) => update({ send: val })}
          />
        </Box>
      </Box>
    );
  }

  // ── Profile view (default) ──
  return (
    <Box className="profile-panel-overlay">
      <Box className="profile-panel-header">
        <IconButton onClick={onBack} className="back-btn" size="small">
          <ArrowLeft size={24} />
        </IconButton>
        <Typography variant="h6" className="header_title">
          Profile
        </Typography>
      </Box>

      <Box className="profile-panel-body">
        <Box className="avatar-section">
          <Box className="avatar-wrapper" style={{ position: "relative", width: avatarSize, height: avatarSize }}>
            {imageUrl && imageState === "loading" && (
              <Skeleton
                variant="circular"
                width={avatarSize}
                height={avatarSize}
                animation="wave"
                sx={{ position: "absolute", top: 0, left: 0 }}
              />
            )}
            <Avatar
              sx={{
                ...avatarConfig.sx,
                width: avatarSize,
                height: avatarSize,
                fontSize: isMobile ? "3rem" : "4rem",
                border: "4px solid var(--color-surface)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                opacity: imageState === "loaded" || !imageUrl ? 1 : 0,
                position: "absolute",
                top: 0,
                left: 0,
                transition: "opacity 0.2s ease-in-out",
              }}
              className="large-avatar"
              src={imageUrl || undefined}
              onLoad={handleLoad}
              onError={handleError}
              slotProps={{ img: { draggable: false } }}
            >
              {avatarConfig.children}
            </Avatar>
          </Box>
        </Box>

        <Box className="info-section">
          <Typography className="info-label">Name</Typography>
          <Typography className="info-value">{(auth?.username as string) || "User"}</Typography>
          <Typography className="info-desc">{(auth?.designation as string) || ""}</Typography>
        </Box>
        {/* Notifications entry — after name/designation, navigates to notifications view */}
        <Box
          onClick={() => setView("notifications")}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",  
            width: "98%",
            px: 2,
            py: 1.5,
            mx: 1.5,
            my: 1,
            borderRadius: 2,
            cursor: "pointer",
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
              Notifications
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: theme.palette.text.secondary }}>
              Sounds, desktop alerts, message preview
            </Typography>
          </Box>
          <ChevronRight size={20} color={theme.palette.text.secondary} />
        </Box>
      </Box>
    </Box>
  );
};

export default ProfilePanel;
