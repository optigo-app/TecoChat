"use client";

import { memo, useState } from "react";
import { Box, IconButton, Skeleton, Typography, useTheme, alpha } from "@mui/material";
import { X } from "lucide-react";
import type { LinkPreviewData } from "../../../../types/message";
import { useSafeLink } from "../../../../hooks/useSafeLink";
import { isImageDead } from "../../../../utils/globalFunc";

// ── LinkPreviewCard ───────────────────────────────────────────────────────────
// WhatsApp-style link preview card.
//
// Two modes:
//   1. Input mode (dismissible=true): horizontal row above chat input —
//      image LEFT, title/description RIGHT, close (X) button.
//      Does NOT push the input/button down — appears as a separate row.
//
//   2. Message mode (dismissible=false, compact=true): vertical card inside
//      message bubbles — image on TOP, text below. Matches WhatsApp's
//      in-message link preview.

interface LinkPreviewCardProps {
  data: LinkPreviewData;
  /** Compact mode for inline message bubbles (smaller card) */
  compact?: boolean;
  /** Show a close (X) button and use horizontal layout for chat input */
  dismissible?: boolean;
  /** Called when the close button is clicked (only in dismissible mode) */
  onDismiss?: () => void;
}

const LinkPreviewCardComponent = ({
  data,
  compact = false,
  dismissible = false,
  onDismiss,
}: LinkPreviewCardProps) => {
  const theme = useTheme();
  const { openLinkSafely } = useSafeLink();
  const [imageError, setImageError] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    // Don't open the link if the close button was clicked
    if ((e.target as HTMLElement).closest("[data-close-btn]")) return;
    openLinkSafely(data.url);
  };

  const showImage = data.image && !imageError && !isImageDead(data.image);
  const accentColor = theme.palette.primary.main;

  // ── Input mode: horizontal row, image LEFT, text RIGHT, close button ────
  if (dismissible) {
    return (
      <Box
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          width: "100%",
          mt: 0.5,
          mb: 0.5,
          p: 1.25,
          borderRadius: 1.5,
          cursor: "pointer",
          backgroundColor: alpha(theme.palette.text.primary, 0.04),
          border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
          transition: "background-color 0.15s",
          "&:hover": {
            backgroundColor: alpha(theme.palette.text.primary, 0.07),
          },
          userSelect: "none",
        }}
      >
        {/* Thumbnail image — LEFT */}
        {showImage && (
          <Box
            sx={{
              flexShrink: 0,
              width: 56,
              height: 56,
              borderRadius: 1,
              overflow: "hidden",
              backgroundColor: alpha(theme.palette.text.primary, 0.06),
            }}
          >
            <img
              src={data.image}
              alt={data.title || data.siteName}
              onError={() => setImageError(true)}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </Box>
        )}

        {/* Title + description — RIGHT (flex: 1) */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {data.title && (
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.3,
                color: theme.palette.text.primary,
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {data.title}
            </Typography>
          )}
          {data.description && (
            <Typography
              sx={{
                fontSize: 11.5,
                lineHeight: 1.3,
                mt: 0.15,
                color: alpha(theme.palette.text.primary, 0.6),
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {data.description}
            </Typography>
          )}
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 500,
              mt: 0.15,
              color: accentColor,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.siteName}
          </Typography>
        </Box>

        {/* Close button — far right */}
        <IconButton
          data-close-btn
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss?.();
          }}
          sx={{
            flexShrink: 0,
            padding: 0.5,
            color: alpha(theme.palette.text.primary, 0.5),
            "&:hover": {
              color: theme.palette.text.primary,
              backgroundColor: alpha(theme.palette.text.primary, 0.08),
            },
          }}
        >
          <X size={16} />
        </IconButton>
      </Box>
    );
  }

  // ── Message mode: responsive layout ────────────────────────────────────
  //   Desktop (>768px):  image LEFT (thumb)  │ title/description RIGHT
  //   Mobile  (<=768px): image TOP full-width │ title/description BELOW
  //      ┌─────────────────────────────┐
  //      │   Preview image (full width) │
  //      ├─────────────────────────────┤
  //      │ Title (bold, 1 line)         │
  //      │ Description (2 lines)        │
  //      │ example.com                  │
  //      └─────────────────────────────┘
  //      https://example.com/path       ← URL stays in message text below
  // On mobile the card never shrinks below ~300px so the image gets a
  // decent area even when the message text is short.
  return (
    <Box
      onClick={handleClick}
      sx={{
        display: "flex",
        // Row on desktop — image left, text right.
        flexDirection: "row",
        alignItems: "stretch",
        gap: 1,
        p: 1,
        width: "100%",
        mt: 0.75,
        borderRadius: 1.5,
        overflow: "hidden",
        cursor: "pointer",
        backgroundColor: alpha(theme.palette.text.primary, 0.04),
        border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
        transition: "background-color 0.15s, border-color 0.15s",
        "&:hover": {
          backgroundColor: alpha(theme.palette.text.primary, 0.07),
          borderColor: alpha(theme.palette.text.primary, 0.15),
        },
        userSelect: "none",
        // Mobile — column: image on top full-width, text below.
        "@media (max-width: 768px)": {
          flexDirection: "column",
          gap: 0,
          p: 0,
          minWidth: "min(300px, 78vw)",
        },
      }}
    >
      {/* Preview image */}
      {showImage && (
        <Box
          sx={{
            flexShrink: 0,
            // Desktop — small square thumb on the left.
            width: compact ? 64 : 80,
            height: compact ? 64 : 80,
            borderRadius: 1,
            overflow: "hidden",
            backgroundColor: alpha(theme.palette.text.primary, 0.06),
            // Mobile — full-width banner on top.
            "@media (max-width: 768px)": {
              width: "100%",
              height: 140,
              borderRadius: 0,
            },
          }}
        >
          <img
            src={data.image}
            alt={data.title || data.siteName}
            onError={() => setImageError(true)}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </Box>
      )}

      {/* Text content */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          "@media (max-width: 768px)": { p: 1 },
        }}
      >
        {/* Title */}
        {data.title && (
          <Typography
            sx={{
              fontSize: compact ? 12.5 : 13.5,
              fontWeight: 700,
              lineHeight: 1.3,
              color: theme.palette.text.primary,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.title}
          </Typography>
        )}

        {/* Description */}
        {data.description && (
          <Typography
            sx={{
              fontSize: compact ? 11.5 : 12.5,
              lineHeight: 1.35,
              mt: 0.25,
              color: alpha(theme.palette.text.primary, 0.65),
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {data.description}
          </Typography>
        )}

        {/* Site name */}
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 500,
            mt: 0.25,
            color: accentColor,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.siteName}
        </Typography>
      </Box>
    </Box>
  );
};

export const LinkPreviewCard = memo(LinkPreviewCardComponent);
export default LinkPreviewCard;

// ── LinkPreviewSkeleton ──────────────────────────────────────────────────────
// Loading skeleton shown while metadata is being fetched.
// Has both input (horizontal) and message (vertical) variants.

interface LinkPreviewSkeletonProps {
  compact?: boolean;
  /** Horizontal layout for chat input preview */
  dismissible?: boolean;
}

export const LinkPreviewSkeleton = memo(function LinkPreviewSkeleton({
  compact = false,
  dismissible = false,
}: LinkPreviewSkeletonProps) {
  const theme = useTheme();

  if (dismissible) {
    // Horizontal skeleton for input preview — full width
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          width: "100%",
          mt: 0.5,
          mb: 0.5,
          p: 1.25,
          borderRadius: 1.5,
          backgroundColor: alpha(theme.palette.text.primary, 0.04),
          border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
        }}
      >
        <Skeleton
          variant="rectangular"
          width={56}
          height={56}
          animation="wave"
          sx={{ borderRadius: 1, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="85%" height={16} animation="wave" />
          <Skeleton variant="text" width="60%" height={14} animation="wave" />
          <Skeleton variant="text" width="40%" height={12} animation="wave" />
        </Box>
      </Box>
    );
  }

  // Skeleton for message bubble — row on desktop, column on mobile
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        gap: 1,
        p: 1,
        width: "100%",
        mt: 0.75,
        borderRadius: 1.5,
        overflow: "hidden",
        backgroundColor: alpha(theme.palette.text.primary, 0.04),
        border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
        "@media (max-width: 768px)": {
          flexDirection: "column",
          gap: 0,
          p: 0,
          minWidth: "min(300px, 78vw)",
        },
      }}
    >
      {/* Image skeleton — thumb on desktop, full-width banner on mobile */}
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{
          width: compact ? 64 : 80,
          height: compact ? 64 : 80,
          borderRadius: 1,
          flexShrink: 0,
          "@media (max-width: 768px)": {
            width: "100%",
            height: 140,
            borderRadius: 0,
          },
        }}
      />
      <Box
        sx={{
          flex: 1,
          "@media (max-width: 768px)": { p: 1 },
        }}
      >
        <Skeleton variant="text" width="85%" height={compact ? 16 : 18} animation="wave" />
        <Skeleton variant="text" width="60%" height={compact ? 14 : 16} animation="wave" sx={{ mt: 0.25 }} />
        <Skeleton
          variant="text"
          width="35%"
          height={12}
          animation="wave"
          sx={{ mt: 0.25, display: "none", "@media (max-width: 768px)": { display: "block" } }}
        />
      </Box>
    </Box>
  );
});
