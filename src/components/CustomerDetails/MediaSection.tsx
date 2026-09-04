"use client";

import { useState, useEffect } from "react";
import { Box, Button, ImageList, ImageListItem, Skeleton, Typography } from "@mui/material";
import useLazyLoading from "./useLazyLoading";
import { Image, Play } from "lucide-react";

interface MediaItem {
  Id?: string | number;
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
}

interface MediaSectionProps {
  mediaItems: MediaItems;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: (() => void) | null;
  onMediaClick: (media: MediaItem) => void;
  paginationFlag: boolean;
}

const MediaSection = ({
  mediaItems,
  isLoading,
  hasMore,
  onLoadMore,
  onMediaClick,
  paginationFlag,
}: MediaSectionProps) => {
  // Combine images and videos
  const combinedMedia = [...(mediaItems.images || []), ...(mediaItems.videos || [])];
  const isVideosOnly = (mediaItems.videos?.length || 0) > 0 && (mediaItems.images?.length || 0) === 0;
  const isImagesOnly = (mediaItems.images?.length || 0) > 0 && (mediaItems.videos?.length || 0) === 0;

  // Smooth empty-state transition
  const [showEmptyState, setShowEmptyState] = useState(false);
  useEffect(() => {
    if (!isLoading && combinedMedia.length === 0) {
      const timer = setTimeout(() => setShowEmptyState(true), 180);
      return () => clearTimeout(timer);
    } else {
      setShowEmptyState(false);
    }
  }, [isLoading, combinedMedia.length]);

  // Lazy loading hook
  const lastMediaElementRef = useLazyLoading(onLoadMore, hasMore && paginationFlag, isLoading);

  const renderSkeletons = () => (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{ color: "text.secondary", fontWeight: 500, mb: 1 }}
      >
        Media
      </Typography>
      <ImageList cols={3} gap={6} sx={{ m: 0 }}>
        {Array.from({ length: 9 }).map((_, idx) => (
          <ImageListItem
            key={`media-skel-${idx}`}
            sx={{ borderRadius: 2, overflow: "hidden" }}
          >
            <Box sx={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
              <Skeleton
                variant="rounded"
                width="100%"
                height="100%"
                sx={{ position: "absolute", inset: 0 }}
              />
            </Box>
          </ImageListItem>
        ))}
      </ImageList>
    </Box>
  );

  // Show nothing if loading and no items
  if (isLoading && combinedMedia.length === 0) {
    return renderSkeletons();
  }

  // Show "No items" message if no items after loading
  if (combinedMedia.length === 0) {
    if (!showEmptyState) {
      // Keep showing skeleton briefly to avoid blink
      return renderSkeletons();
    }
    return (
      <Box
        sx={{
          py: 4,
          textAlign: "center",
          color: "text.secondary",
          animation: "fadeIn 280ms ease-out",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5, opacity: 0.5 }}>
          {isVideosOnly ? <Play size={44} /> : <Image size={44} />}
        </Box>
        <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
          {isVideosOnly ? "No videos found" : "No media found"}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
          {isVideosOnly
            ? "Shared videos will appear here"
            : "Shared photos and videos will appear here"}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{ color: "text.secondary", fontWeight: 500, mb: 1 }}
      >
        {isVideosOnly ? "Videos" : isImagesOnly ? "Media" : "Media"}
      </Typography>
      <ImageList cols={3} gap={6} sx={{ m: 0 }}>
        {combinedMedia.map((item, index) => {
          const isVideo =
            item.type?.startsWith("video/") || item.MimeType?.startsWith("video/");
          const isLastElement = index === combinedMedia.length - 1;
          const title = item.name || item.FileName || (isVideo ? "Video" : "Image");
          const src = item.src || item.FileUrl || "";

          return (
            <ImageListItem
              ref={isLastElement ? lastMediaElementRef : null}
              key={item.Id}
              onClick={() => onMediaClick(item)}
              title={title}
              sx={{ cursor: "pointer" }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 2,
                  overflow: "hidden",
                  bgcolor: "action.hover",
                }}
              >
                {!src ? (
                  <Skeleton
                    variant="rounded"
                    width="100%"
                    height="100%"
                    sx={{ position: "absolute", inset: 0, borderRadius: 0 }}
                  />
                ) : isVideo ? (
                  <Box
                    component="video"
                    preload="metadata"
                    playsInline
                    muted
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  >
                    <source src={src} type="video/mp4" />
                  </Box>
                ) : (
                  <Box
                    component="img"
                    src={src}
                    alt="Shared media"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}

                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(0,0,0,0.28)",
                    opacity: 0,
                    transition: "opacity 160ms ease",
                    "&:hover": { opacity: 1 },
                  }}
                >
                  {src ? (
                    isVideo ? (
                      <Play size={22} color="#fff" />
                    ) : (
                      <Image size={22} color="#fff" />
                    )
                  ) : null}
                </Box>
              </Box>
            </ImageListItem>
          );
        })}
      </ImageList>

      {!paginationFlag && hasMore ? (
        <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}>
          <Button variant="outlined" onClick={onLoadMore || undefined} disabled={isLoading} size="small">
            {isLoading ? "Loading..." : "Load More"}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

export default MediaSection;
