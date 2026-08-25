"use client";

import { useState, useEffect } from "react";
import { Avatar, Skeleton } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import {
  getWhatsAppAvatarConfig,
  getCustomerAvatarSeed,
  hasCustomerName,
  isImageDead,
  markImageAsDead,
} from "../../utils/globalFunc";
import type { ConversationListEntry } from "../../types/conversation";

interface ConversationAvatarProps {
  member: ConversationListEntry;
  size?: number;
}

const isValidUrl = (url: unknown): url is string => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed !== "" && trimmed !== "null" && trimmed !== "undefined";
};

export const ConversationAvatar = ({ member, size = 40 }: ConversationAvatarProps) => {
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">("loading");

  const rawImageUrl = (member as { ProfileImageUrl?: string; AvatarUrl?: string; Avatar?: string })
    ?.ProfileImageUrl || (member as { AvatarUrl?: string })?.AvatarUrl || (member as { Avatar?: string })?.Avatar;
  const imageUrl = isValidUrl(rawImageUrl) && !isImageDead(rawImageUrl) ? rawImageUrl : null;

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

  // No name → generic person icon
  if (!hasCustomerName(member as Parameters<typeof hasCustomerName>[0])) {
    const cfg = getWhatsAppAvatarConfig(getCustomerAvatarSeed(member as Parameters<typeof getCustomerAvatarSeed>[0]), size);
    return (
      <Avatar
        sx={{ ...cfg.sx, width: size, height: size }}
        slotProps={{ img: { draggable: false } }}
      >
        <PersonIcon fontSize="small" />
      </Avatar>
    );
  }

  const avatarConfig =
    (member as { avatarConfig?: ReturnType<typeof getWhatsAppAvatarConfig> }).avatarConfig ||
    getWhatsAppAvatarConfig(
      getCustomerAvatarSeed(member as Parameters<typeof getCustomerAvatarSeed>[0]),
      size
    );

  // Image URL with loading skeleton
  if (imageUrl && imageState !== "error") {
    return (
      <div className="avatar-container" style={{ position: "relative", width: size, height: size }}>
        {imageState === "loading" && (
          <Skeleton
            variant="circular"
            width={size}
            height={size}
            animation="wave"
            sx={{ position: "absolute", top: 0, left: 0 }}
          />
        )}
        <Avatar
          src={imageUrl}
          onLoad={handleLoad}
          onError={handleError}
          slotProps={{ img: { draggable: false } }}
          sx={{
            width: size,
            height: size,
            opacity: imageState === "loaded" ? 1 : 0,
            position: "absolute",
            top: 0,
            left: 0,
            transition: "opacity 0.2s ease-in-out",
          }}
        />
      </div>
    );
  }

  // Fallback: generated avatar with initials
  return (
    <Avatar
      sx={{ ...avatarConfig.sx, width: size, height: size, fontSize: size * 0.4 }}
      slotProps={{ img: { draggable: false } }}
    >
      {avatarConfig.children}
    </Avatar>
  );
};
