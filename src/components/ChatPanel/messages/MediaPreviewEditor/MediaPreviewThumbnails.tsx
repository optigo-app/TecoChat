"use client";

import { alpha, useTheme } from "@mui/material";
import { Plus, X } from "lucide-react";
import type { MediaFileItem, ImageEditState } from "./types";
import { getFilterCssString } from "./constants";
import { hasImageEdits } from "./canvasRender";
import { DocumentTypeIcon } from "../bubble/DocumentTypeIcon";

interface MediaPreviewThumbnailsProps {
  mediaFiles: MediaFileItem[];
  editStates: Record<number, ImageEditState>;
  currentIndex: number;
  isDark: boolean;
  borderColor: string;
  subtitleColor: string;
  thumbsScrollRef: React.RefObject<HTMLDivElement | null>;
  thumbItemRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  getMediaUrl: (item: MediaFileItem) => string;
  onSelectIndex: (index: number) => void;
  onRemoveThumb: (e: React.MouseEvent, index: number) => void;
  onAddMore: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Thumbnail strip with media previews, edit badges, remove buttons, and add-more. */
export default function MediaPreviewThumbnails({
  mediaFiles,
  editStates,
  currentIndex,
  isDark,
  borderColor,
  subtitleColor,
  thumbsScrollRef,
  thumbItemRefs,
  fileInputRef,
  getMediaUrl,
  onSelectIndex,
  onRemoveThumb,
  onAddMore,
  onFileSelect,
}: MediaPreviewThumbnailsProps) {
  const theme = useTheme();

  return (
    <div
      ref={thumbsScrollRef}
      className="media-preview-thumbs"
      style={{
        flexShrink: 0,
        padding: "10px 16px",
        background: isDark ? "rgba(20,20,30,0.85)" : "rgba(255,255,255,0.85)",
        borderTop: `1px solid ${borderColor}`,
        width: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        display: "flex",
        gap: 8,
        alignItems: "center",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {mediaFiles.map((item, index) => {
        const isActive = index === currentIndex;
        const isImage = item.type === "image";
        const isVideo = item.type === "video";
        const thumbSrc = isImage || isVideo ? getMediaUrl(item) : undefined;
        const itemState = editStates[index];
        const hasEdits = hasImageEdits(itemState);

        return (
          <div
            key={`${item.name}-${index}`}
            ref={(el) => {
              thumbItemRefs.current[index] = el;
            }}
            onClick={() => onSelectIndex(index)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              flexShrink: 0,
              width: 58,
              height: 58,
              borderRadius: 12,
              overflow: "hidden",
              cursor: "pointer",
              border: isActive
                ? `2.5px solid ${theme.palette.primary.main}`
                : `1px solid ${borderColor}`,
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
              boxShadow: isActive ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.25)}` : "none",
              transition: "all 0.15s ease",
            }}
          >
            {isVideo ? (
              <video
                src={`${thumbSrc}#t=0.5`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                muted
              />
            ) : isImage ? (
              <img
                src={thumbSrc}
                alt={item.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: itemState ? getFilterCssString(itemState.filter) : "none",
                  transform: itemState?.rotation ? `rotate(${itemState.rotation}deg)` : "none",
                }}
              />
            ) : (
              <DocumentTypeIcon filename={item.name} size={28} />
            )}

            {/* Edit badge on thumbnail */}
            {hasEdits && (
              <div
                style={{
                  position: "absolute",
                  bottom: 3,
                  left: 3,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: theme.palette.primary.main,
                }}
              />
            )}

            {/* Remove button */}
            <button
              onClick={(e) => onRemoveThumb(e, index)}
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                background: "rgba(0,0,0,0.65)",
                border: "none",
                color: "#fff",
                borderRadius: "50%",
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X size={12} color="#fff" />
            </button>
          </div>
        );
      })}

      {/* Add more button */}
      <div
        onClick={onAddMore}
        title="Add more files"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 58,
          height: 58,
          borderRadius: 12,
          border: `2px dashed ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}`,
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.5)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Plus size={22} color={subtitleColor} />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelect}
        multiple
        style={{ display: "none" }}
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.apk,.html,.htm,.py,.js,.jsx,.ts,.tsx,.css,.json,.xml,.zip,.rar,.7z,.sql,.log,.md,.rtf,.psd,.ai,.svg,.eps,.mp3,.wav,.ogg,.m4a,.flac,.aac,.wma,.mp4,.mov,.avi,.mkv,.flv,.wmv,.m4v,.webm"
      />
    </div>
  );
}
