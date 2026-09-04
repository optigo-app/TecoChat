"use client";

import { alpha, IconButton, Popover, Tooltip, Dialog, DialogTitle, DialogContent, useTheme } from "@mui/material";
import { X, Keyboard } from "lucide-react";
import EmojiPickerPopper from "../../input/EmojiPickerPopper";
import { SHAPE_OPTIONS, KEYBOARD_SHORTCUTS } from "./constants";

interface MediaPreviewPopoversProps {
  shapesAnchorEl: HTMLElement | null;
  canvasEmojiAnchorEl: HTMLElement | null;
  showKeyboardHelp: boolean;
  activeShapeType: "rect" | "circle" | "line" | "arrow";
  titleColor: string;
  subtitleColor: string;
  borderColor: string;
  headerBg: string;
  isDark: boolean;
  onCloseShapes: () => void;
  onSelectShape: (id: "rect" | "circle" | "line" | "arrow") => void;
  onCloseCanvasEmoji: () => void;
  onAddCanvasEmoji: (emoji: string, imageUrl?: string) => void;
  onCloseKeyboardHelp: () => void;
}

/** Shapes popover, canvas emoji picker, and keyboard shortcuts dialog. */
export default function MediaPreviewPopovers({
  shapesAnchorEl,
  canvasEmojiAnchorEl,
  showKeyboardHelp,
  activeShapeType,
  titleColor,
  subtitleColor,
  borderColor,
  headerBg,
  isDark,
  onCloseShapes,
  onSelectShape,
  onCloseCanvasEmoji,
  onAddCanvasEmoji,
  onCloseKeyboardHelp,
}: MediaPreviewPopoversProps) {
  const theme = useTheme();
  return (
    <>
      {/* ── Sub-Menu Popover: Shapes ── */}
      <Popover
        open={Boolean(shapesAnchorEl)}
        anchorEl={shapesAnchorEl}
        onClose={onCloseShapes}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: headerBg,
              p: 1.5,
              borderRadius: "16px",
              boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
              border: `1px solid ${borderColor}`,
              display: "flex",
              gap: 1.5,
            },
          },
        }}
      >
        {SHAPE_OPTIONS.map((item) => {
          const Icon = item.icon;
          const isSel = activeShapeType === item.id;
          return (
            <Tooltip key={item.id} title={item.label} arrow>
              <IconButton
                size="large"
                onClick={() => {
                  onSelectShape(item.id);
                  onCloseShapes();
                }}
                sx={{
                  p: "16px 14px",
                  borderRadius: "14px",
                  color: isSel ? theme.palette.primary.main : titleColor,
                  bgcolor: isSel ? alpha(theme.palette.primary.main, 0.15) : "transparent",
                  border: isSel ? `1.5px solid ${theme.palette.primary.main}` : "1.5px solid transparent",
                  flexDirection: "column",
                  gap: 1,
                  minWidth: 78,
                  height: 78,
                  transition: "all 0.15s ease",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Icon size={38} strokeWidth={2} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isSel ? theme.palette.primary.main : titleColor, letterSpacing: 0.2 }}>
                  {item.label}
                </span>
              </IconButton>
            </Tooltip>
          );
        })}
      </Popover>

      {/* ── Sub-Menu Popover: Canvas Emoji Picker ── */}
      <EmojiPickerPopper
        open={Boolean(canvasEmojiAnchorEl)}
        anchorEl={canvasEmojiAnchorEl}
        onEmojiClick={(data) => onAddCanvasEmoji(data.emoji, data.imageUrl)}
        onClose={onCloseCanvasEmoji}
        darkMode={isDark}
      />

      {/* ── Dialog: Keyboard Shortcuts Help ── */}
      <Dialog
        open={showKeyboardHelp}
        onClose={onCloseKeyboardHelp}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              p: 1,
              bgcolor: isDark ? "rgba(26,26,38,0.98)" : "#fff",
              border: `1px solid ${borderColor}`,
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
            <Keyboard size={20} color={theme.palette.primary.main} />
            Keyboard Shortcuts
          </div>
          <IconButton size="small" onClick={onCloseKeyboardHelp}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {KEYBOARD_SHORTCUTS.map((sc) => (
              <div
                key={sc.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                }}
              >
                <span style={{ fontSize: 13, color: subtitleColor }}>{sc.desc}</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                    color: titleColor,
                  }}
                >
                  {sc.key}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
