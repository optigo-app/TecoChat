"use client";

import { useEffect, useState } from "react";
import { alpha, IconButton, Popover, Slider, Tooltip, useTheme } from "@mui/material";
import { HexColorPicker } from "react-colorful";
import { Check, ChevronUp, RefreshCw, RotateCwSquare, RotateCcwSquare, Brush, SquareDashed, Trash2, Sparkles } from "lucide-react";
import type { FilterType, MediaFileItem, ToolMode, TextBgMode, TextElement, ImageEditState } from "./types";
import { FILTERS, WA_COLORS, PEN_STROKE_SIZES, MARKER_STROKE_SIZES, ASPECT_RATIOS } from "./constants";

const COLOR_NAME: Record<string, string> = {
  "#00a884": "Teal",
  "#25d366": "Green",
  "#34b7f1": "Sky",
  "#007aff": "Blue",
  "#9c27b0": "Purple",
  "#e91e63": "Pink",
  "#ff3b30": "Red",
  "#ff9500": "Orange",
  "#ffcc00": "Yellow",
  "#ffffff": "White",
  "#000000": "Black",
};

// ── Filter Bar ─────────────────────────────────────────────────────────────

interface MediaPreviewFilterBarProps {
  currentMedia?: MediaFileItem;
  selectedFilter: FilterType;
  hoveredFilter: FilterType | null;
  titleColor: string;
  borderColor: string;
  isDark: boolean;
  getMediaUrl: (item: MediaFileItem) => string;
  onSelectFilter: (filter: FilterType) => void;
  onHoverFilter: (filter: FilterType | null) => void;
}

/** WhatsApp Web-style filter thumbnail preview bar. */
export function MediaPreviewFilterBar({
  currentMedia,
  selectedFilter,
  hoveredFilter,
  titleColor,
  borderColor,
  isDark,
  getMediaUrl,
  onSelectFilter,
  onHoverFilter,
}: MediaPreviewFilterBarProps) {
  const theme = useTheme();
  if (!currentMedia) return null;

  return (
    <div
      onMouseLeave={() => onHoverFilter(null)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 12px",
        background: isDark ? "rgba(22, 22, 34, 0.98)" : "#f8f9fa",
        borderBottom: `1px solid ${borderColor}`,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        flexShrink: 0,
        zIndex: 15,
      }}
    >
      {FILTERS.map((flt) => {
        const isSel = selectedFilter === flt.id;
        const isHov = hoveredFilter === flt.id;
        return (
          <div
            key={flt.id}
            onClick={() => {
              onSelectFilter(flt.id);
              onHoverFilter(null);
            }}
            onMouseEnter={() => onHoverFilter(flt.id)}
            onMouseLeave={() => onHoverFilter(null)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              padding: "4px 6px",
              borderRadius: 10,
              background: isSel
                ? alpha(theme.palette.primary.main, 0.14)
                : isHov
                  ? isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)"
                  : "transparent",
              flexShrink: 0,
              transition: "background-color 0.12s ease",
              border: "2px solid transparent",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 8,
                overflow: "hidden",
                position: "relative",
                boxShadow: isSel
                  ? `0 0 0 2px ${theme.palette.primary.main}`
                  : isHov
                    ? `0 0 0 1.5px ${alpha(theme.palette.primary.main, 0.7)}`
                    : "0 1px 3px rgba(0,0,0,0.2)",
                transform: isHov && !isSel ? "translateY(-2px)" : "none",
                transition: "transform 0.12s ease, box-shadow 0.12s ease",
              }}
            >
              <img
                src={getMediaUrl(currentMedia)}
                alt={flt.label}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: flt.css,
                  display: "block",
                  pointerEvents: "none",
                }}
              />
              {/* Overlay with right checkmark same like WhatsApp */}
              {isSel && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0, 168, 132, 0.15)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {isSel && (
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: theme.palette.primary.main,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  }}
                >
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: isSel ? 700 : isHov ? 600 : 500,
                color: isSel || isHov ? theme.palette.primary.main : titleColor,
                userSelect: "none",
                whiteSpace: "nowrap",
                transition: "color 0.12s ease",
              }}
            >
              {flt.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Tool Controls Bar ──────────────────────────────────────────────────────

interface MediaPreviewToolControlsProps {
  activeTool: ToolMode;
  activeColor: string;
  activeFillColor: string | null;
  activeStrokeSize: number;
  activeFontFamily: TextElement["fontFamily"];
  activeTextBgMode: TextBgMode;
  activeBlurMode: "path" | "box";
  activeBlurSize: number;
  selectedBlurId: string | null;
  selectedCropAspect: string;
  selectedElementId: string | null;
  titleColor: string;
  subtitleColor: string;
  borderColor: string;
  isDark: boolean;
  onSetColor: (col: string) => void;
  onSetFillColor: (col: string | null) => void;
  onSetStrokeSize: (size: number) => void;
  onSetFontFamily: (font: TextElement["fontFamily"]) => void;
  onSetTextBgMode: (mode: TextBgMode) => void;
  onSetBlurMode: (mode: "path" | "box") => void;
  onSetBlurSize: (size: number) => void;
  onDeleteBlur: () => void;
  onSetCropAspect: (id: string, ratio: number | null) => void;
  onRotateCCW: () => void;
  onRotateCW: () => void;
  onResetCropAndRotate: () => void;
  updateCurrentState: (updater: (prev: ImageEditState) => ImageEditState, recordHistory?: boolean) => void;
}

/** Contextual tool controls bar shown below the header when an image tool is active. */
export function MediaPreviewToolControls({
  activeTool,
  activeColor,
  activeFillColor,
  activeStrokeSize,
  activeFontFamily,
  activeTextBgMode,
  activeBlurMode,
  activeBlurSize,
  selectedBlurId,
  selectedCropAspect,
  selectedElementId,
  titleColor,
  subtitleColor,
  borderColor,
  isDark,
  onSetColor,
  onSetFillColor,
  onSetStrokeSize,
  onSetFontFamily,
  onSetTextBgMode,
  onSetBlurMode,
  onSetBlurSize,
  onDeleteBlur,
  onSetCropAspect,
  onRotateCCW,
  onRotateCW,
  onResetCropAndRotate,
  updateCurrentState,
}: MediaPreviewToolControlsProps) {
  const theme = useTheme();
  const [customColor, setCustomColor] = useState(activeColor);
  const [colorAnchorEl, setColorAnchorEl] = useState<HTMLButtonElement | null>(null);
  const previewColor = colorAnchorEl ? customColor : activeColor;
  const applyColor = (col: string) => {
    onSetColor(col);
    if (selectedElementId) {
      updateCurrentState((prev) => ({
        ...prev,
        texts: prev.texts.map((t) => (t.id === selectedElementId ? { ...t, color: col } : t)),
        shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, color: col } : s)),
      }));
    }
  };
  const themeColor = theme.palette.primary.main;
  const displayColors = ["#000000", "#ffffff", themeColor, ...WA_COLORS.filter((c) => c !== "#000000" && c !== "#ffffff" && c !== "#00a884" && c !== themeColor)];
  const isCustomColor = !displayColors.includes(activeColor);

  useEffect(() => {
    setCustomColor(activeColor);
  }, [activeColor]);

  const closeColor = () => {
    setColorAnchorEl(null);
    applyColor(customColor);
  };

  if (activeTool === "none" || activeTool === "filter") return null;

  const showColors = activeTool === "pen" || activeTool === "marker" || activeTool === "shapes" || activeTool === "text";
  const showStrokes = activeTool === "pen" || activeTool === "marker" || activeTool === "shapes";
  const showFillColors = activeTool === "shapes";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "20px 16px",
        // background: isDark ? "rgba(28,28,40,0.95)" : "#f8f9fa",
        overflowX: "auto",
        flexShrink: 0,
        zIndex: 15,
      }}
    >
      {/* Color Palette (Border/Stroke color for Pen, Marker, Shapes, Text) */}
      {showColors && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
          {displayColors.map((col) => {
            const isActive = activeColor === col;
            const colorLabel = col === themeColor ? "Theme" : (COLOR_NAME[col] || col);
            return (
              <Tooltip key={col} title={colorLabel} arrow placement="top">
                <button
                  aria-label={colorLabel}
                  onClick={() => applyColor(col)}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.18)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = isActive ? "scale(1.15)" : "scale(1)")}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: col,
                    border: isActive
                      ? `2px solid ${theme.palette.primary.main}`
                      : `1.5px solid ${isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.2)"}`,
                    boxShadow: isActive ? "0 0 0 2px #fff" : "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease, border-color 0.22s ease",
                    transform: isActive ? "scale(1.15)" : "scale(1)",
                  }}
                />
              </Tooltip>
            );
          })}
          <button
            title="Custom color"
            onClick={(e) => {
              if (colorAnchorEl) {
                closeColor();
              } else {
                setColorAnchorEl(e.currentTarget);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.18)";
              e.currentTarget.style.backgroundColor = isDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = isCustomColor
                ? "scale(1.15)"
                : "scale(1)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              backgroundColor: "transparent",
              border: "none",
              boxShadow: "none",
              color: isCustomColor ? previewColor : titleColor,
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition:
                "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.22s ease, background-color 0.22s ease",
              transform: isCustomColor ? "scale(1.15)" : "scale(1)",
            }}
          >
            <ChevronUp size={20} strokeWidth={3} />
          </button>
          <Popover
            open={Boolean(colorAnchorEl)}
            anchorEl={colorAnchorEl}
            onClose={closeColor}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            transformOrigin={{ vertical: "bottom", horizontal: "center" }}
            slotProps={{
              paper: {
                sx: {
                  bgcolor: isDark ? "rgba(28,28,40,0.95)" : "#f8f9fa",
                  border: `1px solid ${borderColor}`,
                  borderRadius: "14px",
                  p: 1.5,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                },
              },
            }}
          >
            <HexColorPicker
              color={customColor}
              onChange={setCustomColor}
              style={{ width: 220, height: 220 }}
            />
          </Popover>
        </div>
      )}

      {/* Shape Fill Color Palette */}
      {showFillColors && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8, borderLeft: `1px solid ${borderColor}` }}>
          <span style={{ fontSize: 11, color: subtitleColor, fontWeight: 500, whiteSpace: "nowrap" }}>Fill</span>
          {/* Transparent / no fill */}
          <button
            title="No fill"
            onClick={() => {
              onSetFillColor(null);
              if (selectedElementId) {
                updateCurrentState((prev) => ({
                  ...prev,
                  shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, fillColor: null } : s)),
                }));
              }
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "transparent",
              border: activeFillColor === null ? `2px solid ${theme.palette.primary.main}` : "1.5px solid rgba(0,0,0,0.2)",
              boxShadow: activeFillColor === null ? "0 0 0 2px #fff" : "none",
              cursor: "pointer",
              padding: 0,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: activeFillColor === null ? "scale(1.15)" : "scale(1)",
              transition: "transform 0.1s ease",
            }}
          >
            <span
              style={{
                width: 14,
                height: 1.5,
                background: titleColor,
                transform: "rotate(45deg)",
                borderRadius: 1,
              }}
            />
          </button>
          {WA_COLORS.map((col) => (
            <button
              key={col}
              title="Fill color"
              onClick={() => {
                onSetFillColor(col);
                if (selectedElementId) {
                  updateCurrentState((prev) => ({
                    ...prev,
                    shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, fillColor: col } : s)),
                  }));
                }
              }}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                backgroundColor: col,
                border: activeFillColor === col ? `2px solid ${theme.palette.primary.main}` : "1.5px solid rgba(0,0,0,0.2)",
                boxShadow: activeFillColor === col ? "0 0 0 2px #fff" : "none",
                cursor: "pointer",
                padding: 0,
                transition: "transform 0.1s ease",
                transform: activeFillColor === col ? "scale(1.15)" : "scale(1)",
              }}
            />
          ))}
        </div>
      )}

      {/* Stroke Sizes (for Pen, Marker, Shapes) */}
      {showStrokes && (
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 8, borderLeft: `1px solid ${borderColor}` }}>
          {(activeTool === "marker" ? MARKER_STROKE_SIZES : PEN_STROKE_SIZES).map((st) => {
            const isActive = activeStrokeSize === st.value;
            return (
              <Tooltip key={st.label} title={st.label} arrow placement="top">
                <button
                  aria-label={st.label}
                  onClick={() => onSetStrokeSize(st.value)}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.12)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = isActive ? "scale(1.08)" : "scale(1)")}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "transparent",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0,
                    transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transform: isActive ? "scale(1.08)" : "scale(1)",
                  }}
                >
                  <div
                    style={{
                      width: st.dotSize,
                      height: activeTool === "marker" ? Math.max(5, Math.round(st.dotSize * 0.55)) : st.dotSize,
                      borderRadius: activeTool === "marker" ? 2 : "50%",
                      backgroundColor: isActive ? theme.palette.primary.main : subtitleColor,
                      transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.22s ease",
                    }}
                  />
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Text Tool Options: 3-Mode Background Toggle (font family dropdown hidden) */}
      {activeTool === "text" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8, borderLeft: `1px solid ${borderColor}` }}>
          {/* 3-Mode Background button: None -> Subtle -> Solid */}
          <button
            onClick={() => {
              const nextMode: TextBgMode =
                activeTextBgMode === "none" ? "subtle" : activeTextBgMode === "subtle" ? "solid" : "none";
              onSetTextBgMode(nextMode);
              if (selectedElementId) {
                updateCurrentState((prev) => ({
                  ...prev,
                  texts: prev.texts.map((t) => (t.id === selectedElementId ? { ...t, bgMode: nextMode } : t)),
                }));
              }
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = alpha(theme.palette.primary.main, 0.1))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = activeTextBgMode !== "none" ? alpha(theme.palette.primary.main, 0.15) : "transparent")}
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              border: activeTextBgMode !== "none" ? `1.5px solid ${theme.palette.primary.main}` : `1px solid ${borderColor}`,
              background: activeTextBgMode !== "none" ? alpha(theme.palette.primary.main, 0.15) : "transparent",
              color: titleColor,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "background-color 0.15s ease, border-color 0.15s ease",
            }}
          >
            ✓ Background ({activeTextBgMode === "solid" ? "Solid" : activeTextBgMode === "subtle" ? "Subtle" : "None"})
          </button>
        </div>
      )}

      {/* Blur Options: Mode + Intensity Slider + Delete */}
      {activeTool === "blur" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 8, borderLeft: `1px solid ${borderColor}` }}>
          {/* Mosaic Brush */}
          <Tooltip title="Mosaic Brush — drag to pixelate" arrow>
            <button
              onClick={() => onSetBlurMode("path")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 8,
                border: activeBlurMode === "path" ? `1.5px solid ${theme.palette.primary.main}` : `1px solid ${borderColor}`,
                background: activeBlurMode === "path" ? alpha(theme.palette.primary.main, 0.15) : "transparent",
                color: activeBlurMode === "path" ? theme.palette.primary.main : titleColor,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Brush size={14} />
              Brush
            </button>
          </Tooltip>

          {/* Mosaic Box */}
          <Tooltip title="Mosaic Box — drag a rectangle" arrow>
            <button
              onClick={() => onSetBlurMode("box")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 8,
                border: activeBlurMode === "box" ? `1.5px solid ${theme.palette.primary.main}` : `1px solid ${borderColor}`,
                background: activeBlurMode === "box" ? alpha(theme.palette.primary.main, 0.15) : "transparent",
                color: activeBlurMode === "box" ? theme.palette.primary.main : titleColor,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <SquareDashed size={14} />
              Box
            </button>
          </Tooltip>

          {/* Intensity Slider */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 180 }}>
            <Sparkles size={15} style={{ color: subtitleColor, flexShrink: 0 }} />
            <Slider
              min={0}
              max={100}
              step={1}
              value={activeBlurSize}
              onChange={(_, val) => onSetBlurSize(val as number)}
              sx={{
                color: theme.palette.primary.main,
                flex: 1,
                height: 6,
                "& .MuiSlider-track": { border: "none", height: 6 },
                "& .MuiSlider-rail": { height: 6, opacity: 0.3 },
                "& .MuiSlider-thumb": { width: 18, height: 18, border: "2px solid currentColor", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" },
                "& .MuiSlider-thumb:hover": { boxShadow: "0 0 0 6px rgba(0,0,0,0.08)" },
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: titleColor, minWidth: 28, textAlign: "right" }}>{activeBlurSize}</span>
          </div>

          {/* Delete selected blur region */}
          {selectedBlurId && (
            <Tooltip title="Delete selected blur" arrow>
              <IconButton
                size="small"
                onClick={onDeleteBlur}
                sx={{ color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1), borderRadius: "8px", p: "5px", "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.2) } }}
              >
                <Trash2 size={16} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      )}

      {/* Crop & Rotate Options */}
      {activeTool === "crop" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tooltip title="Rotate 90° CCW" arrow>
            <IconButton size="small" onClick={onRotateCCW} sx={{ color: titleColor, p: "6px" }}>
              <RotateCcwSquare size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rotate 90° CW" arrow>
            <IconButton size="small" onClick={onRotateCW} sx={{ color: titleColor, p: "6px" }}>
              <RotateCwSquare size={18} />
            </IconButton>
          </Tooltip>

          <div style={{ width: 1, height: 20, backgroundColor: borderColor }} />

          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.id}
              onClick={() => onSetCropAspect(ar.id, ar.ratio)}
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                border: selectedCropAspect === ar.id ? `1.5px solid ${theme.palette.primary.main}` : `1px solid ${borderColor}`,
                background: selectedCropAspect === ar.id ? alpha(theme.palette.primary.main, 0.15) : "transparent",
                color: titleColor,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {ar.label}
            </button>
          ))}

          <button
            onClick={onResetCropAndRotate}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              border: `1px solid ${borderColor}`,
              background: "transparent",
              color: titleColor,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <RefreshCw size={13} /> Reset
          </button>
        </div>
      )}
    </div>
  );
}
