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
  const prevSrcRef = useRef<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Revoke the previous blob URL (if any) and clear the ref.
  const revokePrevSrc = () => {
    if (prevSrcRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(prevSrcRef.current);
    }
    prevSrcRef.current = null;
  };

  // Revoke any held blob URL on unmount.
  useEffect(() => {
    return () => {
      if (prevSrcRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(prevSrcRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (src === srcRef.current) return;
    const oldSrc = srcRef.current;
    srcRef.current = src;

    if (!src) {
      revokePrevSrc();
      setCurrentSrc("");
      setPrevSrc(null);
      setIsTransitioning(false);
      setNewLoaded(false);
      return;
    }

    if (oldSrc?.startsWith("blob:") && !src.startsWith("blob:")) {
      revokePrevSrc();
      prevSrcRef.current = oldSrc;
      setPrevSrc(oldSrc);
      setCurrentSrc(src);
      setIsTransitioning(true);
      setNewLoaded(false);
      // Preload in background so the React <img> loads from cache instantly
      const img = new Image();
      img.src = src;
    } else {
      revokePrevSrc();
      setCurrentSrc(src);
      setPrevSrc(null);
      setIsTransitioning(false);
      setNewLoaded(loaded);
    }
  }, [src, keyId, markLoaded, loaded]);

  
  useEffect(() => {
    const img = imgRef.current;
    if (!currentSrc || !img || !img.complete) return;
    const fakeEvent = {
      currentTarget: img,
    } as React.SyntheticEvent<HTMLImageElement>;
    if (img.naturalWidth > 0) {
      handleLoad(fakeEvent);
    } else {
      handleError(fakeEvent);
    }
  }, [currentSrc, keyId]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setNewLoaded(true);
    setIsTransitioning(false);
    revokePrevSrc();
    setPrevSrc(null);
    if (markLoaded && keyId) markLoaded(keyId);
    if (onLoad) onLoad(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setNewLoaded(true);
    setIsTransitioning(false);
    revokePrevSrc();
    setPrevSrc(null);
    if (markLoaded && keyId) markLoaded(keyId);
    if (onError) onError(e);
  };

  const isLoaded = isTransitioning ? newLoaded : loaded || newLoaded;

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
          ref={imgRef}
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

interface CrossFadeVideoProps {
  src: string;
  loaded?: boolean;
  markLoaded?: (key: string) => void;
  keyId?: string;
  style?: React.CSSProperties;
  onError?: () => void;
}

export const CrossFadeVideo = ({
  src,
  loaded = false,
  markLoaded,
  keyId,
  style,
  onError,
}: CrossFadeVideoProps) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [newLoaded, setNewLoaded] = useState(false);
  const srcRef = useRef(src);
  const prevSrcRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const revokePrevSrc = () => {
    if (prevSrcRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(prevSrcRef.current);
    }
    prevSrcRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (prevSrcRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(prevSrcRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (src === srcRef.current) return;
    const oldSrc = srcRef.current;
    srcRef.current = src;

    if (!src) {
      revokePrevSrc();
      setCurrentSrc("");
      setPrevSrc(null);
      setIsTransitioning(false);
      setNewLoaded(false);
      return;
    }

    if (oldSrc?.startsWith("blob:") && !src.startsWith("blob:")) {
      revokePrevSrc();
      prevSrcRef.current = oldSrc;
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
      revokePrevSrc();
      setCurrentSrc(src);
      setPrevSrc(null);
      setIsTransitioning(false);
      setNewLoaded(loaded);
    }
  }, [src, keyId, markLoaded, loaded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!currentSrc || !video) return;
    if (video.error) {
      handleError();
    } else if (video.readyState >= 2) {
      handleLoadedData();
    }
  }, [currentSrc, keyId]);

  const handleLoadedData = () => {
    setNewLoaded(true);
    setIsTransitioning(false);
    revokePrevSrc();
    setPrevSrc(null);
    if (markLoaded && keyId) markLoaded(keyId);
  };

  const handleError = () => {
    setNewLoaded(true);
    setIsTransitioning(false);
    revokePrevSrc();
    setPrevSrc(null);
    if (markLoaded && keyId) markLoaded(keyId);
    if (onError) onError();
  };

  const isLoaded = isTransitioning ? newLoaded : loaded || newLoaded;

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
          ref={videoRef}
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
