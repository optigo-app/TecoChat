"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, IconButton, Box, Typography } from "@mui/material";
import { X, ZoomIn, ZoomOut, Share2, Download } from "lucide-react";

interface ViewPhotoDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

const ViewPhotoDialog = ({
  open,
  onClose,
  imageUrl,
  title = "View Photo",
}: ViewPhotoDialogProps) => {
  const [zoom, setZoom] = useState(1);
  const [displayImageUrl, setDisplayImageUrl] = useState(imageUrl);

  // Full-screen on every device — photo viewer always gets the whole window.
  const isCoarse =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  useEffect(() => {
    if (imageUrl) setDisplayImageUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open]);

  // Back to 1x → recenter the image
  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const handleDoubleClick = () => {
    setZoom((prev) => (prev === 1 ? 2 : 1));
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.5, 1));
  };

  // ── Mobile gestures ────────────────────────────────────────────────────
  // onDoubleClick never fires on touch — do our own double-tap detection.
  // Two-finger pinch scales the image (touch-action: none on the container
  // stops the browser from page-zooming instead). One-finger drag pans
  // while zoomed; a downward swipe (>=80px, unzoomed) dismisses the dialog.
  const lastTapRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // True while fingers are on the glass — disables the transform
  // transition so pinch/pan tracking stays 1:1 with the fingers.
  const [gesturing, setGesturing] = useState(false);

  const touchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDist(e.touches), zoom };
      panRef.current = null;
      touchStartYRef.current = null;
      setGesturing(true);
      return;
    }
    if (zoom > 1) {
      panRef.current = { x: pan.x, y: pan.y, px: e.touches[0].clientX, py: e.touches[0].clientY };
      setGesturing(true);
      return;
    }
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Pinch: scale image by the finger-distance ratio
    if (e.touches.length === 2 && pinchRef.current) {
      const scale = touchDist(e.touches) / pinchRef.current.dist;
      setZoom(Math.min(Math.max(pinchRef.current.zoom * scale, 1), 4));
      return;
    }
    // Pan while zoomed
    if (e.touches.length === 1 && panRef.current && zoom > 1) {
      setPan({
        x: panRef.current.x + e.touches[0].clientX - panRef.current.px,
        y: panRef.current.y + e.touches[0].clientY - panRef.current.py,
      });
      return;
    }
    // Swipe down to dismiss (only when not zoomed)
    if (zoom !== 1 || touchStartYRef.current == null) return;
    if (e.touches[0].clientY - touchStartYRef.current > 80) {
      touchStartYRef.current = null;
      onClose();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) {
      panRef.current = null;
      setGesturing(false);
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300 && e.touches.length === 0) {
      e.preventDefault();
      setZoom((prev) => (prev === 1 ? 2 : 1));
    }
    lastTapRef.current = now;
  };

  // ── Desktop parity: wheel zoom + mouse-drag pan ────────────────────────
  // (touch devices use the pinch/pan/double-tap handlers above)
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mousePanRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Native wheel listener with passive:false — React's onWheel is passive on
  // some browsers so preventDefault() would be ignored and the page would zoom.
  useEffect(() => {
    const el = stageRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(Math.max(z - e.deltaY * 0.0025, 1), 4));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    mousePanRef.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY };
    setGesturing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mousePanRef.current) return;
    setPan({
      x: mousePanRef.current.x + e.clientX - mousePanRef.current.px,
      y: mousePanRef.current.y + e.clientY - mousePanRef.current.py,
    });
  };

  const handleMouseUp = () => {
    mousePanRef.current = null;
    setGesturing(false);
  };

  // ── Share / download — the extra header affordances WhatsApp shows ─────
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url: displayImageUrl, title });
      }
    } catch {
      /* user cancelled or share unsupported */
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = displayImageUrl;
    a.download = "profile-photo";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            borderRadius: 0,
            m: 0,
            bgcolor: "var(--color-wa-modal-bg)",
            color: "var(--color-wa-modal-text)",
            width: "100%",
            height: "100dvh",
            maxHeight: "100dvh",
            // Pinch anywhere on the dialog (header, dead space) zooms the
            // image via our handlers — never the browser's page zoom.
            touchAction: "none",
            overscrollBehavior: "contain",
            boxShadow:
              "0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)",
          },
        },
        backdrop: {
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
          },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.2,
          paddingTop: "calc(10px + var(--safe-top))",
          borderBottom: "1px solid var(--color-wa-modal-header-border)",
          bgcolor: "var(--color-wa-modal-bg)",
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close"
          sx={isCoarse ? { minWidth: 40, minHeight: 40 } : undefined}
        >
          <X size={20} />
        </IconButton>
        <Typography
          sx={{ fontFamily: "Poppins", fontWeight: 500, fontSize: "16px", color: "var(--color-wa-modal-text)" }}
        >
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton
            onClick={handleShare}
            size="small"
            aria-label="Share"
            sx={{ bgcolor: "var(--color-wa-icon-bg)", "&:hover": { bgcolor: "var(--color-wa-icon-bg-hover)", color: "#fff" } }}
          >
            <Share2 size={18} />
          </IconButton>
          <IconButton
            onClick={handleDownload}
            size="small"
            aria-label="Download"
            sx={{ bgcolor: "var(--color-wa-icon-bg)", "&:hover": { bgcolor: "var(--color-wa-icon-bg-hover)", color: "#fff" } }}
          >
            <Download size={18} />
          </IconButton>
          <IconButton
            onClick={handleZoomOut}
            size="small"
            disabled={zoom <= 1}
            aria-label="Zoom out"
            sx={{ bgcolor: "var(--color-wa-icon-bg)", "&:hover": { bgcolor: "var(--color-wa-icon-bg-hover)", color: "#fff" } }}
          >
            <ZoomOut size={18} />
          </IconButton>
          <IconButton
            onClick={handleZoomIn}
            size="small"
            disabled={zoom >= 4}
            aria-label="Zoom in"
            sx={{ bgcolor: "var(--color-wa-icon-bg)", "&:hover": { bgcolor: "var(--color-wa-icon-bg-hover)", color: "#fff" } }}
          >
            <ZoomIn size={18} />
          </IconButton>
        </Box>
      </Box>

      <DialogContent sx={{ p: 0, bgcolor: "#0b0b0b", height: "100%", overflow: "hidden", display: "flex" }}>
        <Box
          ref={stageRef}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            width: "100%",
            height: "100%",
            cursor: zoom > 1 ? "grab" : "zoom-in",
            "&:active": { cursor: zoom > 1 ? "grabbing" : "zoom-in" },
            touchAction: "none",
          }}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={displayImageUrl}
            alt="Profile Photo"
            style={{
              // Square bounds keep borderRadius a circle, never an ellipse.
              width: "min(92vw, 78dvh)",
              maxWidth: "100%",
              aspectRatio: "1 / 1",
              display: "block",
              borderRadius: "50%",
              objectFit: "cover",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: gesturing ? "none" : "transform 0.15s ease-out",
              cursor: zoom > 1 ? "zoom-out" : "zoom-in",
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ViewPhotoDialog;
