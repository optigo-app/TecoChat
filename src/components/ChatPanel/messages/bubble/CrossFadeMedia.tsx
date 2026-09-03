"use client";

// Ported from OldChatReactCode/src/components/chat/messages/MediaMessage.jsx
// CrossFadeImage: keeps old image visible while new one loads, then fades in.
// Prevents blackout/flash when blob: URL is replaced with server URL.

import { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";

interface CrossFadeImageProps {
  src: string;
  alt?: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  style?: React.CSSProperties;
  loaded?: boolean;
  markLoaded?: (key: string) => void;
  keyId?: string;
}

export const CrossFadeImage = ({
  src,
  alt = "",
  onLoad,
  onError,
  style,
  loaded = false,
  markLoaded,
  keyId,
}: CrossFadeImageProps) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [newLoaded, setNewLoaded] = useState(false);
  const srcRef = useRef(src);

  useEffect(() => {
    if (src === srcRef.current) return;
    const oldSrc = srcRef.current;
    srcRef.current = src;

    if (!src) {
      setCurrentSrc("");
      setPrevSrc(null);
      setIsTransitioning(false);
      setNewLoaded(false);
      return;
    }

    // If transitioning from blob: to server URL, keep blob visible while new loads.
    // Only swap visibility when the actual React <img> fires onLoad — NOT when
    // the background `new Image()` preloads. This prevents the flash where
    // prevSrc disappears before the React <img> has rendered the server URL.
    if (oldSrc?.startsWith("blob:") && !src.startsWith("blob:")) {
      setPrevSrc(oldSrc);
      setCurrentSrc(src);
      setIsTransitioning(true);
      setNewLoaded(false);
      // Preload in background so the React <img> loads from cache instantly
      const img = new Image();
      img.src = src;
    } else {
      setCurrentSrc(src);
      setPrevSrc(null);
      setIsTransitioning(false);
      setNewLoaded(loaded);
    }
  }, [src, keyId, markLoaded, loaded]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setNewLoaded(true);
    setIsTransitioning(false);
    if (markLoaded && keyId) markLoaded(keyId);
    if (onLoad) onLoad(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setNewLoaded(true);
    setIsTransitioning(false);
    if (markLoaded && keyId) markLoaded(keyId);
    if (onError) onError(e);
  };

  // During transition: only show new image when the React <img> actually loaded.
  // After transition: fall back to the `loaded` prop from parent.
  const isLoaded = isTransitioning ? newLoaded : loaded;

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {prevSrc && (
        <img
          src={prevSrc}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover" as React.CSSProperties["objectFit"],
            opacity: isLoaded ? 0 : 1,
            transition: "opacity 0.35s ease",
            pointerEvents: "none",
          }}
        />
      )}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover" as React.CSSProperties["objectFit"],
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 0.35s ease",
            ...style,
          }}
        />
      )}
    </Box>
  );
};

// CrossFadeVideo: same cross-fade technique for video thumbnails.
// Keeps old video frame visible while new URL loads.
interface CrossFadeVideoProps {
  src: string;
  loaded?: boolean;
  markLoaded?: (key: string) => void;
  keyId?: string;
  style?: React.CSSProperties;
}

export const CrossFadeVideo = ({
  src,
  loaded = false,
  markLoaded,
  keyId,
  style,
}: CrossFadeVideoProps) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [newLoaded, setNewLoaded] = useState(false);
  const srcRef = useRef(src);

  useEffect(() => {
    if (src === srcRef.current) return;
    const oldSrc = srcRef.current;
    srcRef.current = src;

    if (!src) {
      setCurrentSrc("");
      setPrevSrc(null);
      setIsTransitioning(false);
      setNewLoaded(false);
      return;
    }

    if (oldSrc?.startsWith("blob:") && !src.startsWith("blob:")) {
      setPrevSrc(oldSrc);
      setCurrentSrc(src);
      setIsTransitioning(true);
      setNewLoaded(false);
      // Preload in background so the React <video> loads from cache instantly
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = src;
    } else {
      setCurrentSrc(src);
      setPrevSrc(null);
      setIsTransitioning(false);
      setNewLoaded(loaded);
    }
  }, [src, keyId, markLoaded, loaded]);

  const handleLoadedData = () => {
    setNewLoaded(true);
    setIsTransitioning(false);
    if (markLoaded && keyId) markLoaded(keyId);
  };

  const handleError = () => {
    setNewLoaded(true);
    setIsTransitioning(false);
    if (markLoaded && keyId) markLoaded(keyId);
  };

  const isLoaded = isTransitioning ? newLoaded : loaded;

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {prevSrc && (
        <video
          src={prevSrc}
          muted
          playsInline
          preload="metadata"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover" as React.CSSProperties["objectFit"],
            opacity: isLoaded ? 0 : 1,
            transition: "opacity 0.35s ease",
            pointerEvents: "none",
          }}
        />
      )}
      {currentSrc && (
        <video
          src={currentSrc}
          onLoadedData={handleLoadedData}
          onError={handleError}
          muted
          playsInline
          preload="metadata"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover" as React.CSSProperties["objectFit"],
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 0.35s ease",
            ...style,
          }}
        />
      )}
    </Box>
  );
};
