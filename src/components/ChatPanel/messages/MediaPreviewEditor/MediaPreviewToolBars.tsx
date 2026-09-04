"use client";

import { useEffect, useRef, useState } from "react";
import { alpha, IconButton, Popover, Slider, Tooltip, useTheme } from "@mui/material";
import { HexColorPicker } from "react-colorful";
import { Check, ChevronUp, RefreshCw, RotateCwSquare, RotateCcwSquare, Trash2, Droplets, Grid } from "lucide-react";
import type { FilterType, MediaFileItem, ToolMode, TextBgMode, TextElement, ImageEditState } from "./types";
import { FILTERS, WA_COLORS, WA_TEXT_COLORS, ASPECT_RATIOS, FONT_FAMILIES } from "./constants";

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

// ── Tool Controls Bar (WhatsApp-style floating bottom toolbar) ─────────────

interface MediaPreviewToolControlsProps {
  activeTool: ToolMode;
  activeColor: string;
  activeFillColor: string | null;
  activeStrokeSize: number;
  activeFontFamily: TextElement["fontFamily"];
  activeTextBgMode: TextBgMode;
  activeBlurMode: "path" | "box";
  activeBlurSize: number;
  activeBlurStyle?: "pixelate" | "smooth";
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
  onSetBlurStyle?: (style: "pixelate" | "smooth") => void;
  onDeleteBlur: () => void;
  onSetCropAspect: (id: string, ratio: number | null) => void;
  onRotateCCW: () => void;
  onRotateCW: () => void;
  onResetCropAndRotate: () => void;
  updateCurrentState: (updater: (prev: ImageEditState) => ImageEditState, recordHistory?: boolean) => void;
}

/** WhatsApp-style floating bottom toolbar with collapsible sub-panel. */
export function MediaPreviewToolControls({
  activeTool,
  activeColor,
  activeFillColor,
  activeStrokeSize,
  activeFontFamily,
  activeTextBgMode,
  activeBlurMode,
  activeBlurSize,
  activeBlurStyle = "pixelate",
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
  onSetBlurStyle,
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
  const [blurStyleAnchorEl, setBlurStyleAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [fontAnchorEl, setFontAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [shapePanel, setShapePanel] = useState<"none" | "border" | "fill">("none");
  const shapeToolbarRef = useRef<HTMLDivElement | null>(null);
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
  const isTextTool = activeTool === "text";
  const displayColors = isTextTool
    ? WA_TEXT_COLORS
    : ["#000000", "#ffffff", themeColor, ...WA_COLORS.filter((c) => c !== "#000000" && c !== "#ffffff" && c !== "#00a884" && c !== themeColor)];
  const isCustomColor = !displayColors.includes(activeColor);
  const currentFontObj = FONT_FAMILIES.find((f) => f.id === activeFontFamily) || FONT_FAMILIES[0];

  useEffect(() => {
    setCustomColor(activeColor);
  }, [activeColor]);

  // Reset expanded state when switching tools
  useEffect(() => {
    setExpanded(false);
    setShapePanel("none");
  }, [activeTool]);

  // Close shape panel when clicking outside the toolbar
  useEffect(() => {
    if (shapePanel === "none") return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shapeToolbarRef.current && !shapeToolbarRef.current.contains(e.target as Node)) {
        setShapePanel("none");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shapePanel]);

  const closeColor = () => {
    setColorAnchorEl(null);
    applyColor(customColor);
  };

  if (activeTool === "none" || activeTool === "filter") return null;

  const showColors = activeTool === "pen" || activeTool === "marker" || activeTool === "text";
  const showStrokes = activeTool === "pen" || activeTool === "marker";
  const showFillColors = false; // shapes tool has its own dedicated UI now
  const isCropTool = activeTool === "crop";
  const isBlurTool = activeTool === "blur";
  const isTextOptions = activeTool === "text";

  // ── Floating panel styles ──
  const panelBg = isDark ? "rgba(30, 30, 42, 0.96)" : "rgba(255, 255, 255, 0.97)";
  const panelBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const panelShadow = "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)";

  // ── Crop & Rotate: simple centered bar (no floating panel needed) ──
  if (isCropTool) {
    return (
      <div
        style={{
          flexShrink: 0,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px 14px",
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 16px",
            background: panelBg,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 28,
            border: `1px solid ${panelBorder}`,
            boxShadow: panelShadow,
            maxWidth: "100%",
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <Tooltip title="Rotate 90° CCW" arrow placement="top">
            <IconButton
              size="small"
              onClick={onRotateCCW}
              sx={{
                color: titleColor,
                p: "6px",
                borderRadius: "50%",
                transition: "all 0.15s ease",
                "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
              }}
            >
              <RotateCcwSquare size={20} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rotate 90° CW" arrow placement="top">
            <IconButton
              size="small"
              onClick={onRotateCW}
              sx={{
                color: titleColor,
                p: "6px",
                borderRadius: "50%",
                transition: "all 0.15s ease",
                "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
              }}
            >
              <RotateCwSquare size={20} />
            </IconButton>
          </Tooltip>
          <div style={{ width: 1, height: 22, backgroundColor: panelBorder, flexShrink: 0 }} />
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.id}
              onClick={() => onSetCropAspect(ar.id, ar.ratio)}
              style={{
                padding: "5px 12px",
                borderRadius: 12,
                border: selectedCropAspect === ar.id ? `1.5px solid ${theme.palette.primary.main}` : `1px solid ${panelBorder}`,
                background: selectedCropAspect === ar.id ? alpha(theme.palette.primary.main, 0.15) : "transparent",
                color: selectedCropAspect === ar.id ? theme.palette.primary.main : titleColor,
                fontSize: 12,
                fontWeight: selectedCropAspect === ar.id ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {ar.label}
            </button>
          ))}
          <div style={{ width: 1, height: 22, backgroundColor: panelBorder, flexShrink: 0 }} />
          <Tooltip title="Reset crop & rotation" arrow placement="top">
            <button
              onClick={onResetCropAndRotate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 12,
                border: `1px solid ${panelBorder}`,
                background: "transparent",
                color: titleColor,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <RefreshCw size={14} /> Reset
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  // ── Shapes tool: WhatsApp-style 2-dot design (border donut + fill solid) ──
  if (activeTool === "shapes") {
    const applyBorderColor = (col: string) => {
      onSetColor(col);
      if (selectedElementId) {
        updateCurrentState((prev) => ({
          ...prev,
          shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, color: col } : s)),
        }));
      }
    };
    const applyFillColor = (col: string | null) => {
      onSetFillColor(col);
      if (selectedElementId) {
        updateCurrentState((prev) => ({
          ...prev,
          shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, fillColor: col } : s)),
        }));
      }
    };
    const applyStrokeWidth = (val: number) => {
      onSetStrokeSize(val);
      if (selectedElementId) {
        updateCurrentState((prev) => ({
          ...prev,
          shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, strokeWidth: val } : s)),
        }), false);
      }
    };

    return (
      <div
        ref={shapeToolbarRef}
        style={{
          flexShrink: 0,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px 14px",
          maxWidth: "100%",
        }}
      >
        {/* ── Expanded panel for border or fill ── */}
        {shapePanel !== "none" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "12px 18px",
              background: panelBg,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: 16,
              border: `1px solid ${panelBorder}`,
              boxShadow: panelShadow,
              minWidth: 280,
              maxWidth: "100%",
              animation: "toolBarSlideIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Color row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 400 }}>
              {/* Transparent option (fill panel only) */}
              {shapePanel === "fill" && (
                <Tooltip title="No fill" arrow placement="top">
                  <button
                    onClick={() => applyFillColor(null)}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = activeFillColor === null ? "scale(1.1)" : "scale(1)")}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                      border: activeFillColor === null
                        ? `2.5px solid ${theme.palette.primary.main}`
                        : `1.5px solid ${isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)"}`,
                      boxShadow: activeFillColor === null ? "0 0 0 2px " + panelBg : "none",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      transform: activeFillColor === null ? "scale(1.1)" : "scale(1)",
                    }}
                  >
                    <span style={{ width: 16, height: 2, background: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)", transform: "rotate(45deg)", borderRadius: 2 }} />
                  </button>
                </Tooltip>
              )}
              {/* Color circles */}
              {displayColors.map((col) => {
                const isActive = shapePanel === "border" ? activeColor === col : activeFillColor === col;
                const colorLabel = col === themeColor ? "Theme" : (COLOR_NAME[col] || col);
                return (
                  <Tooltip key={col} title={colorLabel} arrow placement="top">
                    <button
                      aria-label={colorLabel}
                      onClick={() => shapePanel === "border" ? applyBorderColor(col) : applyFillColor(col)}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = isActive ? "scale(1.15)" : "scale(1)")}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        backgroundColor: col,
                        border: isActive
                          ? `2.5px solid ${theme.palette.primary.main}`
                          : `1.5px solid ${isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)"}`,
                        boxShadow: isActive ? "0 0 0 2px " + panelBg : "none",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                        transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease, border-color 0.22s ease",
                        transform: isActive ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  </Tooltip>
                );
              })}
            </div>

            {/* Stroke width slider (border panel only) */}
            {shapePanel === "border" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minWidth: 240 }}>
                <Slider
                  min={1}
                  max={52}
                  step={1}
                  value={activeStrokeSize}
                  onChange={(_e, v) => applyStrokeWidth(v as number)}
                  sx={{
                    color: theme.palette.primary.main,
                    flex: 1,
                    height: 4,
                    "& .MuiSlider-track": { border: "none", height: 4 },
                    "& .MuiSlider-rail": { height: 4, opacity: 0.25 },
                    "& .MuiSlider-thumb": {
                      width: 16,
                      height: 16,
                      backgroundColor: theme.palette.primary.main,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                      "&:hover, &.Mui-focusVisible": { boxShadow: "0 2px 8px rgba(0,0,0,0.35)" },
                    },
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: titleColor, minWidth: 28, textAlign: "center" }}>
                  {activeStrokeSize}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Main toolbar: 2 dot groups (each with own arrow) + delete ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "8px 16px",
            background: panelBg,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 28,
            border: `1px solid ${panelBorder}`,
            boxShadow: panelShadow,
            maxWidth: "100%",
          }}
        >
          {/* Fill color group (first): solid dot with border ring + individual arrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Tooltip title="Fill color" arrow placement="top">
              <button
                onClick={() => setShapePanel(shapePanel === "fill" ? "none" : "fill")}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: activeFillColor || "transparent",
                  border: activeFillColor
                    ? `3px solid ${activeFillColor}`
                    : `3px dashed ${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)"}`,
                  boxShadow: shapePanel === "fill" ? `0 0 0 2px ${theme.palette.primary.main}` : "none",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                  transform: shapePanel === "fill" ? "scale(1.1)" : "scale(1)",
                  boxSizing: "border-box",
                  position: "relative",
                }}
              >
                {/* Inner solid fill circle (fills the donut hole) */}
                {activeFillColor && (
                  <span
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: activeFillColor,
                      pointerEvents: "none",
                    }}
                  />
                )}
                {/* Diagonal slash when no fill */}
                {!activeFillColor && (
                  <span
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%) rotate(45deg)",
                      width: 14,
                      height: 2,
                      background: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
                      borderRadius: 2,
                      pointerEvents: "none",
                    }}
                  />
                )}
              </button>
            </Tooltip>
            <Tooltip title={shapePanel === "fill" ? "Collapse fill" : "Expand fill colors"} arrow placement="top">
              <button
                onClick={() => setShapePanel(shapePanel === "fill" ? "none" : "fill")}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: "transparent",
                  border: "none",
                  boxShadow: "none",
                  color: shapePanel === "fill" ? theme.palette.primary.main : subtitleColor,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
              >
                <ChevronUp
                  size={18}
                  strokeWidth={2.5}
                  style={{
                    transform: shapePanel === "fill" ? "rotate(180deg)" : "none",
                    transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              </button>
            </Tooltip>
          </div>

          {/* Divider between fill and border groups */}
          <div style={{ width: 1, height: 20, backgroundColor: panelBorder, flexShrink: 0 }} />

          {/* Border color group (second): donut dot + individual arrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Tooltip title="Border color" arrow placement="top">
              <button
                onClick={() => setShapePanel(shapePanel === "border" ? "none" : "border")}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "transparent",
                  border: `3px solid ${activeColor}`,
                  boxShadow: shapePanel === "border" ? `0 0 0 2px ${theme.palette.primary.main}` : "none",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                  transform: shapePanel === "border" ? "scale(1.1)" : "scale(1)",
                  boxSizing: "border-box",
                }}
              />
            </Tooltip>
            <Tooltip title={shapePanel === "border" ? "Collapse border" : "Expand border colors"} arrow placement="top">
              <button
                onClick={() => setShapePanel(shapePanel === "border" ? "none" : "border")}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: "transparent",
                  border: "none",
                  boxShadow: "none",
                  color: shapePanel === "border" ? theme.palette.primary.main : subtitleColor,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
              >
                <ChevronUp
                  size={18}
                  strokeWidth={2.5}
                  style={{
                    transform: shapePanel === "border" ? "rotate(180deg)" : "none",
                    transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              </button>
            </Tooltip>
          </div>

          {/* Delete selected shape */}
          {selectedElementId && (
            <div style={{ width: 1, height: 20, backgroundColor: panelBorder, flexShrink: 0 }} />
          )}
          {selectedElementId && (
            <Tooltip title="Delete selected shape" arrow>
              <IconButton
                size="small"
                onClick={() => {
                  updateCurrentState((prev) => ({
                    ...prev,
                    shapes: prev.shapes.filter((s) => s.id !== selectedElementId),
                  }));
                }}
                sx={{
                  color: subtitleColor,
                  p: "5px",
                  borderRadius: "10px",
                  transition: "all 0.15s ease",
                  "&:hover": { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1) },
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </Tooltip>
          )}
        </div>

        <style>{`
          @keyframes toolBarSlideIn {
            0% { opacity: 0; transform: translateY(12px) scale(0.96); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // ── Blur tool: WhatsApp-style with style toggle + slider + trash ──
  if (isBlurTool) {
    const applyBlurStyle = (style: "pixelate" | "smooth") => {
      onSetBlurStyle?.(style);
      if (selectedBlurId) {
        const idx = parseInt(selectedBlurId.replace("blur_", ""), 10);
        updateCurrentState((prev) => ({
          ...prev,
          blurRegions: prev.blurRegions.map((b, i) => (i === idx ? { ...b, style } : b)),
        }));
      }
    };
    const applyBlurSize = (val: number) => {
      onSetBlurSize(val);
      if (selectedBlurId) {
        const idx = parseInt(selectedBlurId.replace("blur_", ""), 10);
        updateCurrentState((prev) => ({
          ...prev,
          blurRegions: prev.blurRegions.map((b, i) => (i === idx ? { ...b, intensity: val } : b)),
        }), false);
      }
    };

    return (
      <div
        style={{
          flexShrink: 0,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px 14px",
          maxWidth: "100%",
        }}
      >
        {/* ── Expanded panel: slider ── */}
        {expanded && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              background: panelBg,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: 16,
              border: `1px solid ${panelBorder}`,
              boxShadow: panelShadow,
              minWidth: 280,
              maxWidth: "100%",
              animation: "toolBarSlideIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minWidth: 240 }}>
              <Slider
                min={5}
                max={100}
                step={1}
                value={activeBlurSize}
                onChange={(_e, v) => applyBlurSize(v as number)}
                sx={{
                  color: theme.palette.primary.main,
                  flex: 1,
                  height: 4,
                  "& .MuiSlider-track": { border: "none", height: 4 },
                  "& .MuiSlider-rail": { height: 4, opacity: 0.25 },
                  "& .MuiSlider-thumb": {
                    width: 16,
                    height: 16,
                    backgroundColor: theme.palette.primary.main,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                    "&:hover, &.Mui-focusVisible": { boxShadow: "0 2px 8px rgba(0,0,0,0.35)" },
                  },
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: titleColor, minWidth: 28, textAlign: "center" }}>
                {activeBlurSize}
              </span>
            </div>
          </div>
        )}

        {/* ── Main toolbar: style toggle + arrow + trash ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
            background: panelBg,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 28,
            border: `1px solid ${panelBorder}`,
            boxShadow: panelShadow,
            maxWidth: "100%",
          }}
        >
          {/* Pixelate style button */}
          <Tooltip title="Pixelate (Mosaic)" arrow placement="top">
            <button
              onClick={() => applyBlurStyle("pixelate")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 10,
                border: (activeBlurStyle || "pixelate") === "pixelate" ? `1.5px solid ${theme.palette.primary.main}` : `1px solid ${panelBorder}`,
                background: (activeBlurStyle || "pixelate") === "pixelate" ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                color: (activeBlurStyle || "pixelate") === "pixelate" ? theme.palette.primary.main : titleColor,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Grid size={16} /> Pixelate
            </button>
          </Tooltip>

          {/* Smooth blur style button */}
          <Tooltip title="Smooth Blur" arrow placement="top">
            <button
              onClick={() => applyBlurStyle("smooth")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 10,
                border: activeBlurStyle === "smooth" ? `1.5px solid ${theme.palette.primary.main}` : `1px solid ${panelBorder}`,
                background: activeBlurStyle === "smooth" ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                color: activeBlurStyle === "smooth" ? theme.palette.primary.main : titleColor,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Droplets size={16} /> Blur
            </button>
          </Tooltip>

          {/* Divider */}
          <div style={{ width: 1, height: 20, backgroundColor: panelBorder, flexShrink: 0 }} />

          {/* Expand/collapse arrow for slider */}
          <Tooltip title={expanded ? "Collapse slider" : "Expand slider"} arrow placement="top">
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                backgroundColor: "transparent",
                border: "none",
                boxShadow: "none",
                color: expanded ? theme.palette.primary.main : subtitleColor,
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
            >
              <ChevronUp
                size={18}
                strokeWidth={2.5}
                style={{
                  transform: expanded ? "rotate(180deg)" : "none",
                  transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              />
            </button>
          </Tooltip>

          {/* Delete blur region */}
          {selectedBlurId && (
            <div style={{ width: 1, height: 20, backgroundColor: panelBorder, flexShrink: 0 }} />
          )}
          {selectedBlurId && (
            <Tooltip title="Delete blur region" arrow>
              <IconButton
                size="small"
                onClick={onDeleteBlur}
                sx={{
                  color: subtitleColor,
                  p: "5px",
                  borderRadius: "10px",
                  transition: "all 0.15s ease",
                  "&:hover": { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1) },
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </Tooltip>
          )}
        </div>

        <style>{`
          @keyframes toolBarSlideIn {
            0% { opacity: 0; transform: translateY(12px) scale(0.96); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // ── Slider config per tool ──
  const sliderConfig = isBlurTool
    ? { min: 5, max: 100, step: 1, value: activeBlurSize, onChange: (_e: unknown, v: number | number[]) => onSetBlurSize(v as number) }
    : { min: 1, max: 52, step: 1, value: activeStrokeSize, onChange: (_e: unknown, v: number | number[]) => onSetStrokeSize(v as number) };
  // Blur tool has its own dedicated UI; only show generic slider for pen/marker
  const showGenericSlider = showStrokes;

  return (
    <div
      style={{
        flexShrink: 0,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px 14px",
        maxWidth: "100%",
      }}
    >
      {/* ── Expanded Sub-panel (slider + actions) ── */}
      <div
        style={{
          display: expanded ? "flex" : "none",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          padding: "12px 18px",
          background: panelBg,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 16,
          border: `1px solid ${panelBorder}`,
          boxShadow: panelShadow,
          minWidth: 280,
          maxWidth: "100%",
          animation: "toolBarSlideIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Slider row */}
        {showGenericSlider ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minWidth: 240 }}>
            <Slider
              {...sliderConfig}
              sx={{
                color: theme.palette.primary.main,
                flex: 1,
                height: 4,
                "& .MuiSlider-track": { border: "none", height: 4 },
                "& .MuiSlider-rail": { height: 4, opacity: 0.25 },
                "& .MuiSlider-thumb": {
                  width: 16,
                  height: 16,
                  backgroundColor: theme.palette.primary.main,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                  "&:hover, &.Mui-focusVisible": { boxShadow: "0 2px 8px rgba(0,0,0,0.35)" },
                },
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: titleColor, minWidth: 28, textAlign: "center" }}>
              {sliderConfig.value}
            </span>
          </div>
        ) : null}

        {/* Text tool: font family + background toggle */}
        {isTextOptions && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={(e) => setFontAnchorEl(e.currentTarget)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 10,
                border: `1px solid ${panelBorder}`,
                background: Boolean(fontAnchorEl) ? (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") : "transparent",
                color: titleColor,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                A
              </span>
              <span>{currentFontObj.label}</span>
              <ChevronUp size={14} style={{ transform: fontAnchorEl ? "none" : "rotate(180deg)", transition: "transform 0.2s ease" }} />
            </button>

            <Popover
              open={Boolean(fontAnchorEl)}
              anchorEl={fontAnchorEl}
              onClose={() => setFontAnchorEl(null)}
              anchorOrigin={{ vertical: "top", horizontal: "center" }}
              transformOrigin={{ vertical: "bottom", horizontal: "center" }}
              slotProps={{
                paper: {
                  sx: {
                    bgcolor: isDark ? "#1f2c34" : "#ffffff",
                    border: `1px solid ${borderColor}`,
                    borderRadius: "12px",
                    p: 0.5,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                    minWidth: 150,
                  },
                },
              }}
            >
              {FONT_FAMILIES.map((font) => (
                <div
                  key={font.id}
                  onClick={() => {
                    onSetFontFamily(font.id);
                    if (selectedElementId) {
                      updateCurrentState((prev) => ({
                        ...prev,
                        texts: prev.texts.map((t) => (t.id === selectedElementId ? { ...t, fontFamily: font.id } : t)),
                      }));
                    }
                    setFontAnchorEl(null);
                  }}
                  style={{
                    padding: "8px 14px",
                    cursor: "pointer",
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: font.font,
                    color: activeFontFamily === font.id ? theme.palette.primary.main : titleColor,
                    background: activeFontFamily === font.id ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = alpha(theme.palette.primary.main, 0.08))}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = activeFontFamily === font.id ? alpha(theme.palette.primary.main, 0.12) : "transparent")}
                >
                  {font.label}
                </div>
              ))}
            </Popover>

            <button
              onClick={() => {
                const nextMode: TextBgMode =
                  activeTextBgMode === "none" ? "solid" : activeTextBgMode === "solid" ? "subtle" : "none";
                onSetTextBgMode(nextMode);
                if (selectedElementId) {
                  updateCurrentState((prev) => ({
                    ...prev,
                    texts: prev.texts.map((t) => (t.id === selectedElementId ? { ...t, bgMode: nextMode } : t)),
                  }));
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 10,
                border: activeTextBgMode !== "none" ? `1.5px solid ${theme.palette.primary.main}` : `1px solid ${panelBorder}`,
                background: activeTextBgMode !== "none" ? alpha(theme.palette.primary.main, 0.14) : "transparent",
                color: activeTextBgMode !== "none" ? theme.palette.primary.main : titleColor,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Check size={15} strokeWidth={2.5} />
              <span>Background</span>
            </button>
          </div>
        )}

        {/* Fill colors row (shapes only) */}
        {showFillColors && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 360 }}>
            <Tooltip title="No fill" arrow placement="top">
              <button
                onClick={() => {
                  onSetFillColor(null);
                  if (selectedElementId) {
                    updateCurrentState((prev) => ({
                      ...prev,
                      shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, fillColor: null } : s)),
                    }));
                  }
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = activeFillColor === null ? "scale(1.1)" : "scale(1)")}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  border: activeFillColor === null
                    ? `2.5px solid ${theme.palette.primary.main}`
                    : `1.5px solid ${isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)"}`,
                  boxShadow: activeFillColor === null ? "0 0 0 2px " + panelBg : "none",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transform: activeFillColor === null ? "scale(1.1)" : "scale(1)",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 2,
                    background: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
                    transform: "rotate(45deg)",
                    borderRadius: 2,
                  }}
                />
              </button>
            </Tooltip>
            {WA_COLORS.map((col) => {
              const isActive = activeFillColor === col;
              return (
                <Tooltip key={col} title="Fill color" arrow placement="top">
                  <button
                    onClick={() => {
                      onSetFillColor(col);
                      if (selectedElementId) {
                        updateCurrentState((prev) => ({
                          ...prev,
                          shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, fillColor: col } : s)),
                        }));
                      }
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = isActive ? "scale(1.15)" : "scale(1)")}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      backgroundColor: col,
                      border: isActive
                        ? `2.5px solid ${theme.palette.primary.main}`
                        : `1.5px solid ${isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)"}`,
                      boxShadow: isActive ? "0 0 0 2px " + panelBg : "none",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                      transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease, border-color 0.22s ease",
                      transform: isActive ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Delete button */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isTextOptions && selectedElementId && (
            <Tooltip title="Delete selected text" arrow>
              <IconButton
                size="small"
                onClick={() => {
                  updateCurrentState((prev) => ({
                    ...prev,
                    texts: prev.texts.filter((t) => t.id !== selectedElementId),
                  }));
                }}
                sx={{
                  color: subtitleColor,
                  p: "5px",
                  borderRadius: "10px",
                  transition: "all 0.15s ease",
                  "&:hover": { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1) },
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </Tooltip>
          )}
          {showFillColors && selectedElementId && (
            <Tooltip title="Delete selected shape" arrow>
              <IconButton
                size="small"
                onClick={() => {
                  updateCurrentState((prev) => ({
                    ...prev,
                    shapes: prev.shapes.filter((s) => s.id !== selectedElementId),
                  }));
                }}
                sx={{
                  color: subtitleColor,
                  p: "5px",
                  borderRadius: "10px",
                  transition: "all 0.15s ease",
                  "&:hover": { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1) },
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Main Bottom Toolbar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          background: panelBg,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 28,
          border: `1px solid ${panelBorder}`,
          boxShadow: panelShadow,
          maxWidth: "100%",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Color circles */}
        {showColors && (
          <>
            {displayColors.map((col) => {
              const isActive = activeColor === col;
              const colorLabel = col === themeColor ? "Theme" : (COLOR_NAME[col] || col);
              return (
                <Tooltip key={col} title={colorLabel} arrow placement="top">
                  <button
                    aria-label={colorLabel}
                    onClick={() => applyColor(col)}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = isActive ? "scale(1.15)" : "scale(1)")}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      backgroundColor: col,
                      border: isActive
                        ? `2.5px solid ${theme.palette.primary.main}`
                        : `1.5px solid ${isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)"}`,
                      boxShadow: isActive ? "0 0 0 2px " + panelBg : "none",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                      transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease, border-color 0.22s ease",
                      transform: isActive ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                </Tooltip>
              );
            })}

            {/* Custom color picker */}
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
                e.currentTarget.style.transform = "scale(1.15)";
                e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = isCustomColor ? "scale(1.1)" : "scale(1)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "transparent",
                border: "none",
                boxShadow: "none",
                color: isCustomColor ? previewColor : subtitleColor,
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.22s ease, background-color 0.22s ease",
                transform: isCustomColor ? "scale(1.1)" : "scale(1)",
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

            {/* Divider before expand/collapse */}
            <div style={{ width: 1, height: 22, backgroundColor: panelBorder, flexShrink: 0 }} />
          </>
        )}

        {/* Expand / Collapse arrow */}
        <Tooltip title={expanded ? "Collapse" : "Expand options"} arrow placement="top">
          <button
            onClick={() => setExpanded((v) => !v)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.15)";
              e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: "transparent",
              border: "none",
              boxShadow: "none",
              color: expanded ? theme.palette.primary.main : subtitleColor,
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.22s ease, background-color 0.22s ease",
            }}
          >
            <ChevronUp
              size={20}
              strokeWidth={2.5}
              style={{
                transform: expanded ? "none" : "rotate(180deg)",
                transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          </button>
        </Tooltip>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes toolBarSlideIn {
          0% { opacity: 0; transform: translateY(12px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
