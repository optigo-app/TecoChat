"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@mui/material";
import { X } from "lucide-react";
import { ConversationAvatar } from "../ConversationAvatar/ConversationAvatar";
import { isImageDead, markImageAsDead } from "../../utils/globalFunc";
import type { ConversationListEntry } from "../../types/conversation";
import ViewPhotoDialog from "../ReusableComponent/ViewPhotoDialog";

interface AvatarPreviewCardProps {
  member: ConversationListEntry;
  anchorRect: DOMRect;
  onClose: () => void;
  onOpenChat: () => void;
}

const isValidUrl = (url: unknown): url is string => {
  if (!url || typeof url !== "string") return false;
  const t = url.trim().toLowerCase();
  return t !== "" && t !== "null" && t !== "undefined";
};

/**
 * WhatsApp-style long-press avatar preview: a card pops up over the list at
 * the avatar position — big square photo, name on a bottom gradient, and an
 * action row. Backdrop tap / Escape / scroll-dismiss closes it.
 */
const AvatarPreviewCard = ({ member, anchorRect, onClose }: AvatarPreviewCardProps) => {
  const name =
    (member as { name?: string }).name ||
    (member as { UserName?: string }).UserName ||
    (member as { ConversationName?: string }).ConversationName ||
    "Unknown";

  const rawImageUrl =
    (member as { ProfileImageUrl?: string }).ProfileImageUrl ||
    (member as { AvatarUrl?: string }).AvatarUrl ||
    (member as { Avatar?: string }).Avatar;
  const initialUrl =
    isValidUrl(rawImageUrl) && !isImageDead(rawImageUrl) ? rawImageUrl : null;
  const [imageUrl, setImageUrl] = useState<string | null>(initialUrl);
  const [viewPhotoOpen, setViewPhotoOpen] = useState(false);

  // Tapping the photo opens the full-screen viewer (WhatsApp behavior) —
  // it replaces the preview so closing the viewer doesn't reopen the card.
  const handlePhotoClick = () => {
    if (!imageUrl) return;
    setViewPhotoOpen(true);
  };

  // Escape / outside scroll dismiss — same dismiss surface as WhatsApp.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onClose, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onClose);
    };
  }, [onClose]);

  // Clamp inside the viewport — 8px margins, card ~300px tall max.
  const cardSize = Math.min(300, window.innerWidth - 48);
  const cardHeight = cardSize; // photo only — actions row removed
  const top = Math.max(
    8,
    Math.min(anchorRect.top - 8, window.innerHeight - cardHeight - 8)
  );
  const left = Math.max(
    8,
    Math.min(anchorRect.left - 4, window.innerWidth - cardSize - 16)
  );

  const preview = (
    <>
      <div
        className="avatar-preview-backdrop"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
      />
      <div className="avatar-preview-card" style={{ top, left, width: cardSize }}>
        <div
          className="avatar-preview-photo"
          style={{ height: cardSize, cursor: imageUrl ? "zoom-in" : "default" }}
          onClick={handlePhotoClick}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              draggable={false}
              onError={() => {
                markImageAsDead(imageUrl);
                setImageUrl(null);
              }}
            />
          ) : (
            <ConversationAvatar member={member} size={Math.min(180, cardSize - 60)} />
          )}
          <div className="avatar-preview-name">{name}</div>
        </div>
        {/* Close — top-right of the photo, WhatsApp style */}
        <IconButton
          size="small"
          onClick={onClose}
          className="avatar-preview-close"
          aria-label="Close preview"
        >
          <X size={18} />
        </IconButton>
      </div>
      <ViewPhotoDialog
        open={viewPhotoOpen}
        onClose={() => setViewPhotoOpen(false)}
        imageUrl={imageUrl || ""}
        title={name}
      />
    </>
  );

  return createPortal(preview, document.body);
};

export default AvatarPreviewCard;
