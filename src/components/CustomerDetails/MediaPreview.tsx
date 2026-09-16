"use client";

import { Typography } from "@mui/material";
import { ChevronRight, Image, Play } from "lucide-react";

interface MediaItem {
  src?: string;
  FileUrl?: string;
  name?: string;
  FileName?: string;
  type?: string;
  MimeType?: string;
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

  // Combine images and videos for the preview row (images first, then videos)
  const previewItems: MediaItem[] = [
    ...(mediaItems.images || []),
    ...(mediaItems.videos || []),
  ].slice(0, 5);

  const isVideo = (item: MediaItem): boolean =>
    !!item.type?.startsWith("video/") || !!item.MimeType?.startsWith("video/");

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

      {previewItems.length > 0 && (
        <div
          className="media-preview-grid"
          style={{
            padding: "0 16px 16px 16px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: "8px",
          }}
        >
          {previewItems.map((item, i) => {
            const video = isVideo(item);
            const src = (item.src as string) || (item.FileUrl as string) || "";
            const itemKey = String(item.Id ?? item.FileUrl ?? item.src ?? i);

            return (
              <div
                key={itemKey}
                className="preview-item"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: "8px",
                  overflow: "hidden",
                  cursor: "pointer",
                  position: "relative",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onMediaClick?.(item);
                }}
              >
                {video ? (
                  <>
                    <video
                      src={src}
                      preload="metadata"
                      muted
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.3)",
                      }}
                    >
                      <Play size={20} color="#fff" />
                    </div>
                  </>
                ) : (
                  <img
                    src={src}
                    alt={(item.name as string) || (item.FileName as string) || "Media preview"}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MediaPreview;
