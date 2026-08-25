"use client";

import { useState, useEffect } from "react";
import { Box, Typography, IconButton, Avatar, Skeleton } from "@mui/material";
import { ArrowLeft } from "lucide-react";
import { useLoginContext } from "../../context/LoginData";
import { getWhatsAppAvatarConfig, isImageDead, markImageAsDead } from "../../utils/globalFunc";
import { useIsMobile } from "@/src/hooks/useIsMobile";
import "./ProfilePanel.scss";

interface ProfilePanelProps {
  onBack: () => void;
}

const isValidUrl = (url: unknown): url is string => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed !== "" && trimmed !== "null" && trimmed !== "undefined";
};

const ProfilePanel = ({ onBack }: ProfilePanelProps) => {
  const { auth } = useLoginContext();
  const isMobile = useIsMobile();
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
      </Box>
    </Box>
  );
};

export default ProfilePanel;
