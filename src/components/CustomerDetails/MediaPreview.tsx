"use client";

import { Typography } from "@mui/material";
import { ChevronRight, Image } from "lucide-react";

interface MediaItem {
  src?: string;
  FileUrl?: string;
  [key: string]: unknown;
}

interface MediaItems {
  images?: MediaItem[];
  videos?: MediaItem[];
  documents?: MediaItem[];
}

interface MediaPreviewProps {
  mediaItems: MediaItems;
  onClick: () => void;
  onMediaClick?: (media: MediaItem) => void;
}

const MediaPreview = ({ mediaItems, onClick, onMediaClick }: MediaPreviewProps) => {
  const totalCount =
    (mediaItems.images?.length || 0) +
    (mediaItems.videos?.length || 0) +
    (mediaItems.documents?.length || 0);

  return (
    <div className="settings-list">
      <div
        className="setting-item clickable-member"
        onClick={onClick}
        style={{ cursor: "pointer" }}
      >
        <div className="setting-left">
          <Image size={20} color="var(--color-text-secondary)" />
          <span>Media, docs and links</span>
        </div>
        <div
          className="header-right"
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          {totalCount > 0 && (
            <Typography
              className="count"
              sx={{ fontSize: "14px", color: "var(--color-text-secondary)" }}
            >
              {totalCount}
            </Typography>
          )}
          <ChevronRight
            size={20}
            className="chevron"
            style={{ color: "var(--color-text-secondary)" }}
          />
        </div>
      </div>

      {totalCount > 0 && mediaItems.images?.length! > 0 && (
        <div
          className="media-preview-grid"
          style={{ padding: "0 16px 16px 16px", display: "flex", gap: "8px" }}
        >
          {mediaItems?.images?.slice(0, 5).map((img, i) => (
            <div
              key={i}
              className="preview-item"
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "8px",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onMediaClick?.(img);
              }}
            >
              <img
                src={img.src as string}
                alt={(img.name as string) || "Media preview"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaPreview;
