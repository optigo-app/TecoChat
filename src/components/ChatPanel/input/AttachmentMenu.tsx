"use client";

import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, MenuItem, ListItemIcon, ListItemText, Typography, Box } from "@mui/material";
import { Image, Video, FileText, Camera } from "lucide-react";
import { useIsMobile, useResponsiveLayout } from "../../../hooks/useIsMobile";

interface AttachmentMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onFilePick: (e: React.MouseEvent, params: { accept: string; type: string }) => void;
  onCameraPick?: (e: React.MouseEvent) => void;
}

// WhatsApp attach-sheet ordering: Document, Camera, Gallery, then extras.
// Camera is phone-only — tablets get the sheet layout but no camera tile
// (capture UX there is inconsistent across Android WebView/iPadOS anyway).
const DOC_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.epub,.zip,.rar,.7z,.json,.xml,.html,.htm,.md,.log,.sql,.apk";

const AttachmentMenuComponent = ({
  anchorEl,
  open,
  onClose,
  onFilePick,
  onCameraPick,
}: AttachmentMenuProps) => {
  const isMobile = useIsMobile();
  const { width } = useResponsiveLayout();
  // Camera is phone-only. <=768 alone still catches iPad portrait (768px) and
  // iPad mini (744px) — real phones top out around ~540 CSS px and tablets
  // start at ~600px, so gate on a strict phone-width cut + coarse pointer.
  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarsePointer(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);
  const isHandset = width > 0 && width <= 560;
  const showCamera = isMobile && isHandset && coarsePointer && !!onCameraPick;

  // Close the mobile sheet on Escape — same contract as the desktop Menu.
  useEffect(() => {
    if (!open || !isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMobile, onClose]);

  // WhatsApp keeps the composer visible — the attach sheet opens ABOVE the
  // input bar, not over it. Measure .chat-input-area's height and offset the
  // sheet by that amount. Re-measure while open (multiline input grows).
  const [composerHeight, setComposerHeight] = useState(0);
  useEffect(() => {
    if (!open || !isMobile) return;
    const measure = () => {
      const el = document.querySelector(".chat-input-area");
      if (el) setComposerHeight(el.getBoundingClientRect().height);
    };
    measure();
    const t = setInterval(measure, 300);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", measure);
    };
  }, [open, isMobile]);

  // ── Mobile: WhatsApp-style bottom sheet with circular icon tiles ──────────
  if (isMobile) {
    if (!open || typeof document === "undefined") return null;

    const pick = (accept: string, type: string) => () => {
      onClose();
      // onFilePick opens the file input — must run inside the tap gesture.
      onFilePick({} as React.MouseEvent, { accept, type });
    };

    const tiles: {
      id: string;
      label: string;
      icon: typeof Camera;
      color: string;
      onPick: () => void;
    }[] = [
      { id: "document", label: "Document", icon: FileText, color: "#7f66ff", onPick: pick(DOC_ACCEPT, "document") },
      ...(showCamera
        ? [{
            id: "camera",
            label: "Camera",
            icon: Camera,
            color: "#ff2e74",
            onPick: () => {
              onClose();
              onCameraPick?.({} as React.MouseEvent);
            },
          }]
        : []),
      { id: "gallery", label: "Gallery", icon: Image, color: "#bf59cf", onPick: pick("image/*", "image") },
      { id: "video", label: "Video", icon: Video, color: "#f96800", onPick: pick("video/*", "video") },
    ];

    return createPortal(
      <Box
        onClick={onClose}
        sx={{
          position: "fixed",
          inset: 0,
          // Leave the composer uncovered — sheet sits above the input bar,
          // so the input stays visible/tappable like WhatsApp.
          bottom: `${composerHeight}px`,
          height: "auto",
          top: 0,
          zIndex: (t) => t.zIndex.modal + 20,
          bgcolor: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "flex-end",
          animation: "attachBackdropIn 0.2s ease",
          "@keyframes attachBackdropIn": {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        }}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            width: "100%",
            bgcolor: (t) => (t.palette.mode === "dark" ? "#232333" : "#ffffff"),
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            px: 2.5,
            pt: 2,
            pb: "calc(20px + var(--safe-bottom))",
            boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
            animation: "attachSheetIn 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
            "@keyframes attachSheetIn": {
              from: { transform: "translateY(100%)" },
              to: { transform: "translateY(0)" },
            },
          }}
        >
          {/* Drag handle */}
          <Box
            sx={{
              width: 36,
              height: 4,
              borderRadius: 2,
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
              mx: "auto",
              mb: 2.5,
            }}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${tiles.length}, 1fr)`,
              gap: 1,
            }}
          >
            {tiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <Box
                  key={tile.id}
                  component="button"
                  type="button"
                  onClick={tile.onPick}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                    py: 1,
                    border: "none",
                    bgcolor: "transparent",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    "&:active .attach-tile-icon": { transform: "scale(0.92)" },
                  }}
                >
                  <Box
                    className="attach-tile-icon"
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      bgcolor: tile.color,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <Icon size={24} />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 500, fontSize: 12 }}
                  >
                    {tile.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>,
      document.body
    );
  }

  // ── Desktop / tablet: popover menu ─────────────────────────────────────────
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      onClick={(e) => e.stopPropagation()}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 20 }}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            minWidth: 200,
            borderRadius: 2.5,
            py: 1,
            mb: 1.5,
            // Glassmorphic surface
            bgcolor: (t: { palette: { mode: string } }) =>
              t.palette.mode === "dark"
                ? "rgba(35, 35, 51, 0.82)"
                : "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "0px 10px 25px rgba(0,0,0,0.12), 0px 4px 10px rgba(0,0,0,0.08)",
            border: (t: { palette: { mode: string } }) =>
              t.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(255,255,255,0.5)",
          },
        },
      }}
      transformOrigin={{ horizontal: "left", vertical: "bottom" }}
      anchorOrigin={{ horizontal: "left", vertical: "top" }}
    >
      <MenuItem
        onClick={(e) => onFilePick(e, { accept: "image/*", type: "image" })}
        sx={{ py: 1.2, px: 2.5, mx: 0.8, borderRadius: 1.5 }}
      >
        <ListItemIcon sx={{ minWidth: "38px", color: "#0046FF" }}>
          <Image size={18} />
        </ListItemIcon>
        <ListItemText>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Photo</Typography>
        </ListItemText>
      </MenuItem>

      <MenuItem
        onClick={(e) => onFilePick(e, { accept: "video/*", type: "video" })}
        sx={{ py: 1.2, px: 2.5, mx: 0.8, borderRadius: 1.5 }}
      >
        <ListItemIcon sx={{ minWidth: "38px", color: "#FF8040" }}>
          <Video size={18} />
        </ListItemIcon>
        <ListItemText>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Video</Typography>
        </ListItemText>
      </MenuItem>

      <MenuItem
        onClick={(e) =>
          onFilePick(e, {
            // Documents only — no image/video/audio (those have own pickers)
            accept: DOC_ACCEPT,
            type: "document",
          })
        }
        sx={{ py: 1.2, px: 2.5, mx: 0.8, borderRadius: 1.5 }}
      >
        <ListItemIcon sx={{ minWidth: "38px", color: "#9929EA" }}>
          <FileText size={18} />
        </ListItemIcon>
        <ListItemText>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Document</Typography>
        </ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default memo(AttachmentMenuComponent);
