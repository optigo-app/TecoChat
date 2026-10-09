"use client";

import { useState } from "react";
import { alpha, IconButton, Popover, Tooltip, useTheme } from "@mui/material";
import {
  X,
  Info,
  Undo2,
  Redo2,
  Crop,
  Wand2,
  Pencil,
  Highlighter,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Aperture,
  Smile,
  Check,
  Copy,
  Download,
  Trash2,
  RotateCcw,
} from "lucide-react";
import type { ToolMode, ImageEditState, MediaFileItem } from "./types";
import { KEYBOARD_SHORTCUTS } from "./constants";
import { useIsMobile } from "../../../../hooks/useIsMobile";
/** Shared styling for the image-editing buttons in the preview header. */
function MediaPreviewToolButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Tooltip title={label} arrow>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          color: active ? theme.palette.text.primary : (isDark ? "rgba(255,255,255,0.75)" : "#54656f"),
          bgcolor: active ? (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)") : "transparent",
          borderRadius: "50%",
          width: 38,
          height: 38,
          p: 0,
          transition: "all 0.15s ease",
          "&:hover": {
            bgcolor: active ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)") : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
            color: theme.palette.text.primary,
          },
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

/** Metadata shown in the header when the selected item is not an image. */
function MediaPreviewFileInfo({ name, sizeText, extText, currentIndex, total, titleColor, subtitleColor }: { name?: string; sizeText: string; extText: string; currentIndex: number; total: number; titleColor: string; subtitleColor: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, paddingLeft: 8 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: titleColor,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name || "Media preview"}
      </div>
      <div style={{ fontSize: 12, color: subtitleColor }}>
        {sizeText} · {extText} · {currentIndex + 1} of {total}
      </div>
    </div>
  );
}

interface MediaPreviewHeaderProps {
  currentMedia?: MediaFileItem;
  isImage: boolean;
  currentIndex: number;
  total: number;
  activeTool: ToolMode;
  activeShapeType: "rect" | "circle" | "line" | "arrow";
  canUndo: boolean;
  canRedo: boolean;
  copied: boolean;
  selectedElementId: string | null;
  canvasEmojiAnchorEl: HTMLElement | null;
  sizeText: string;
  extText: string;
  titleColor: string;
  subtitleColor: string;
  borderColor: string;
  headerBg: string;
  isDark: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleTool: (tool: ToolMode) => void;
  onOpenShapes: (el: HTMLElement) => void;
  onOpenCanvasEmoji: (el: HTMLElement) => void;
  onDone: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onDeleteOrRemove: () => void;
  onResetAll: () => void;
  hasEdits: boolean;
}

/** Top header toolbar with close, undo/redo, image editing tools, and right-side controls. */
export default function MediaPreviewHeader({
  currentMedia,
  isImage,
  currentIndex,
  total,
  activeTool,
  activeShapeType,
  canUndo,
  canRedo,
  copied,
  selectedElementId,
  canvasEmojiAnchorEl,
  sizeText,
  extText,
  titleColor,
  subtitleColor,
  borderColor,
  headerBg,
  isDark,
  onClose,
  onUndo,
  onRedo,
  onToggleTool,
  onOpenShapes,
  onOpenCanvasEmoji,
  onDone,
  onCopy,
  onDownload,
  onDeleteOrRemove,
  onResetAll,
  hasEdits,
}: MediaPreviewHeaderProps) {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const [infoAnchorEl, setInfoAnchorEl] = useState<HTMLElement | null>(null);

  // Keyboard-shortcuts info button + popover — in the header row so it
  // doesn't float over the canvas/image.
  const infoControl = (
    <>
      <Tooltip title="Keyboard shortcuts" arrow>
        <IconButton
          size="small"
          onClick={(e) => setInfoAnchorEl(e.currentTarget)}
          aria-label="Keyboard shortcuts"
          sx={{
            color: subtitleColor,
            borderRadius: "50%",
            width: 38,
            height: 38,
            p: 0,
            "&:hover": {
              bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              color: theme.palette.primary.main,
            },
          }}
        >
          <Info size={18} />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(infoAnchorEl)}
        anchorEl={infoAnchorEl}
        onClose={() => setInfoAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "14px",
              p: 1.5,
              bgcolor: isDark ? "rgba(26,26,38,0.98)" : "#fff",
              border: `1px solid ${borderColor}`,
              boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
              maxWidth: 320,
            },
          },
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: titleColor, marginBottom: 10 }}>
          <Info size={18} color={theme.palette.primary.main} />
          Keyboard Shortcuts
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {KEYBOARD_SHORTCUTS.map((sc) => (
            <div
              key={sc.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "5px 10px",
                borderRadius: 8,
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              }}
            >
              <span style={{ fontSize: 12, color: subtitleColor }}>{sc.desc}</span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 5,
                  background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                  color: titleColor,
                }}
              >
                {sc.key}
              </span>
            </div>
          ))}
        </div>
      </Popover>
    </>
  );

  const toolRow = isImage && (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        // "safe center" — centers when all tools fit, falls back to
        // start alignment when overflowing so the first tools stay
        // reachable by scrolling (plain center would clip them).
        justifyContent: "safe center",
        gap: isMobile ? 0 : 4,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        minWidth: 0,
      }}
    >
      <MediaPreviewToolButton label="Crop & Rotate (C)" active={activeTool === "crop"} onClick={() => onToggleTool("crop")}>
        <Crop size={20} />
      </MediaPreviewToolButton>

      <MediaPreviewToolButton label="Filters (F)" active={activeTool === "filter"} onClick={() => onToggleTool("filter")}>
        <Wand2 size={20} />
      </MediaPreviewToolButton>

      <MediaPreviewToolButton label="Draw Pen (P)" active={activeTool === "pen"} onClick={() => onToggleTool("pen")}>
        <Pencil size={20} />
      </MediaPreviewToolButton>

      <MediaPreviewToolButton label="Highlighter / Marker (M)" active={activeTool === "marker"} onClick={() => onToggleTool("marker")}>
        <Highlighter size={20} />
      </MediaPreviewToolButton>

      <MediaPreviewToolButton label="Text (T)" active={activeTool === "text"} onClick={() => onToggleTool("text")}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 1,
            fontFamily: "var(--font-family)",
            letterSpacing: "-0.3px",
          }}
        >
          Aa
        </span>
      </MediaPreviewToolButton>

      {/* Shapes Dropdown */}
      <Tooltip title="Shapes (S)" arrow>
        <IconButton
          size="small"
          onClick={(e) => onOpenShapes(e.currentTarget)}
          sx={{
            color: activeTool === "shapes" ? theme.palette.text.primary : (isDark ? "rgba(255,255,255,0.75)" : "#54656f"),
            bgcolor: activeTool === "shapes" ? (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)") : "transparent",
            borderRadius: "50%",
            width: 38,
            height: 38,
            p: 0,
            transition: "all 0.15s ease",
            "&:hover": {
              bgcolor: activeTool === "shapes" ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)") : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
              color: theme.palette.text.primary,
            },
          }}
        >
          {activeShapeType === "rect" && <Square size={20} />}
          {activeShapeType === "circle" && <Circle size={20} />}
          {activeShapeType === "line" && <Minus size={20} />}
          {activeShapeType === "arrow" && <MoveUpRight size={20} />}
        </IconButton>
      </Tooltip>

      <MediaPreviewToolButton label="Blur (B)" active={activeTool === "blur"} onClick={() => onToggleTool("blur")}>
        <Aperture size={20} />
      </MediaPreviewToolButton>

      {/* Emoji Sticker for Image */}
      <Tooltip title="Add Emoji Sticker (E)" arrow>
        <IconButton
          size="small"
          onClick={(e) => onOpenCanvasEmoji(e.currentTarget)}
          sx={{
            color: canvasEmojiAnchorEl ? theme.palette.text.primary : (isDark ? "rgba(255,255,255,0.75)" : "#54656f"),
            bgcolor: canvasEmojiAnchorEl ? (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)") : "transparent",
            borderRadius: "50%",
            width: 38,
            height: 38,
            p: 0,
            transition: "all 0.15s ease",
            "&:hover": {
              bgcolor: canvasEmojiAnchorEl ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)") : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
              color: theme.palette.text.primary,
            },
          }}
        >
          <Smile size={20} />
        </IconButton>
      </Tooltip>
    </div>
  );

  // ── Mobile: two-row header — controls on top, tools on their own row ───
  if (isMobile) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
          paddingTop: "max(6px, var(--safe-top))",
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {/* Row 1: Close · Undo · Redo — sp — Done · Trash */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                color: titleColor,
                borderRadius: "10px",
                p: "7px",
                "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
              }}
            >
              <X size={20} />
            </IconButton>
            {isImage && (
              <>
                <IconButton
                  size="small"
                  onClick={onUndo}
                  disabled={!canUndo}
                  sx={{ color: titleColor, borderRadius: "10px", p: "7px", opacity: canUndo ? 1 : 0.4 }}
                >
                  <Undo2 size={18} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={onRedo}
                  disabled={!canRedo}
                  sx={{ color: titleColor, borderRadius: "10px", p: "7px", opacity: canRedo ? 1 : 0.4 }}
                >
                  <Redo2 size={18} />
                </IconButton>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {!isImage && (
              <MediaPreviewFileInfo
                name={currentMedia?.name}
                sizeText={sizeText}
                extText={extText}
                currentIndex={currentIndex}
                total={total}
                titleColor={titleColor}
                subtitleColor={subtitleColor}
              />
            )}
            {infoControl}
            {isImage && (
              <button
                onClick={onDone}
                style={{
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: activeTool !== "none" ? theme.palette.text.primary : (isDark ? "rgba(255,255,255,0.6)" : "#54656f"),
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                Done
              </button>
            )}
            <IconButton
              size="small"
              onClick={onDeleteOrRemove}
              sx={{
                color: selectedElementId ? theme.palette.error.main : titleColor,
                borderRadius: "10px",
                p: "7px",
              }}
            >
              <Trash2 size={20} />
            </IconButton>
          </div>
        </div>

        {/* Row 2: annotation tool strip — full width, horizontally scrollable */}
        {isImage && (
          <div
            style={{
              borderTop: `1px solid ${borderColor}`,
              padding: "4px 8px",
            }}
          >
            {toolRow}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        background: headerBg,
        borderBottom: `1px solid ${borderColor}`,
        paddingTop: "max(8px, var(--safe-top))",
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Left: Close, Undo, Redo */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 2 : 6 }}>
        <Tooltip title="Close (Esc)" arrow>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              color: titleColor,
              borderRadius: "10px",
              p: "7px",
              "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
            }}
          >
            <X size={20} />
          </IconButton>
        </Tooltip>

        {isImage && (
          <>
            <Tooltip title="Undo (Ctrl+Z)" arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={onUndo}
                  disabled={!canUndo}
                  sx={{
                    color: titleColor,
                    borderRadius: "10px",
                    p: "7px",
                    opacity: canUndo ? 1 : 0.4,
                  }}
                >
                  <Undo2 size={18} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Redo (Ctrl+Y)" arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={onRedo}
                  disabled={!canRedo}
                  sx={{
                    color: titleColor,
                    borderRadius: "10px",
                    p: "7px",
                    opacity: canRedo ? 1 : 0.4,
                  }}
                >
                  <Redo2 size={18} />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
      </div>

      {/* Center: Top Image Editing Tools Bar */}
      {isImage ? (
        toolRow
      ) : (
        <MediaPreviewFileInfo
          name={currentMedia?.name}
          sizeText={sizeText}
          extText={extText}
          currentIndex={currentIndex}
          total={total}
          titleColor={titleColor}
          subtitleColor={subtitleColor}
        />
      )}

      {/* Right Controls: Reset, Done, Copy, Download, Trash */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {isImage && (
          <>
            {/* Reset all edits — icon + text, before Done */}
            {hasEdits && (
              <button
                onClick={onResetAll}
                style={{
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: isDark ? "rgba(255,255,255,0.6)" : "#54656f",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
                  e.currentTarget.style.color = theme.palette.warning.main;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = isDark ? "rgba(255,255,255,0.6)" : "#54656f";
                }}
              >
                <RotateCcw size={16} />
                Reset
              </button>
            )}

            {/* Done Button (WhatsApp Web styled text button) */}
            <button
              onClick={onDone}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: activeTool !== "none" ? theme.palette.text.primary : (isDark ? "rgba(255,255,255,0.6)" : "#54656f"),
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              Done
            </button>

            {/* Copy edited image to clipboard */}
            <Tooltip title={copied ? "Copied!" : "Copy to clipboard (Ctrl+C)"} arrow>
              <IconButton
                size="small"
                onClick={onCopy}
                sx={{
                  color: copied ? theme.palette.success.main : titleColor,
                  bgcolor: copied ? alpha(theme.palette.success.main, 0.18) : "transparent",
                  borderRadius: "10px",
                  p: "7px",
                  transition: "color 0.2s ease, background-color 0.2s ease",
                  "&:hover": {
                    bgcolor: copied
                      ? alpha(theme.palette.success.main, 0.22)
                      : isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                  },
                  "@keyframes copyPop": {
                    "0%": { transform: "scale(1)" },
                    "40%": { transform: "scale(1.3)" },
                    "100%": { transform: "scale(1)" },
                  },
                  "& svg": copied
                    ? { animation: "copyPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }
                    : {},
                }}
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </IconButton>
            </Tooltip>

            {/* Download */}
            <Tooltip title="Download edited image" arrow>
              <IconButton
                size="small"
                onClick={onDownload}
                sx={{
                  color: titleColor,
                  borderRadius: "10px",
                  p: "7px",
                }}
              >
                <Download size={20} />
              </IconButton>
            </Tooltip>
          </>
        )}
        {infoControl}

        {/* Trash / Delete */}
        <Tooltip
          title={selectedElementId ? "Delete selected element (Del)" : "Remove current item"}
          arrow
        >
          <IconButton
            size="small"
            onClick={onDeleteOrRemove}
            sx={{
              color: selectedElementId ? theme.palette.error.main : titleColor,
              borderRadius: "10px",
              p: "7px",
            }}
          >
            <Trash2 size={20} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}
