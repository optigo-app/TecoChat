"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { alpha, Skeleton, useTheme } from "@mui/material";
import { ChevronLeft, ChevronRight, FileText, Trash2 } from "lucide-react";
import EmojiPickerPopper from "../../input/EmojiPickerPopper";
import type { MediaFileItem, ImageEditState, ToolMode, TextElement, CropRect, FilterType } from "./types";
import { getFilterCssString } from "./constants";

interface MediaPreviewStageProps {
  currentMedia?: MediaFileItem;
  currentIndex: number;
  mediaFilesLength: number;
  isImage: boolean;
  isVideo: boolean;
  isFile: boolean;
  loadedVideos: Set<string>;
  activeTool: ToolMode;
  activeColor: string;
  activeFontFamily: TextElement["fontFamily"];
  activeTextBgMode: TextElement["bgMode"];
  textInputActive: boolean;
  textInputValue: string;
  textInputPos: { x: number; y: number };
  selectedElementId: string | null;
  editingTextId: string | null;
  selectedBlurId: string | null;
  hoveredFilter: FilterType | null;
  currentState: ImageEditState;
  titleColor: string;
  subtitleColor: string;
  borderColor: string;
  isDark: boolean;
  iconUrl?: string;
  sizeText: string;
  extText: string;
  getMediaUrl: (item: MediaFileItem) => string;
  mediaStageRef: React.RefObject<HTMLDivElement | null>;
  imgElementRef: React.RefObject<HTMLImageElement | null>;
  annotationCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  pointerDragRef: React.MutableRefObject<{
    isDown: boolean;
    startPoint: { x: number; y: number };
    currentPoint: { x: number; y: number };
    dragType: "draw" | "shape" | "blur" | "move-element" | "crop-handle" | "crop-move" | "shape-handle" | "blur-move" | "blur-resize" | null;
    elementId?: string;
    cropHandle?: string;
    blurHandle?: string;
    initialCrop?: CropRect;
    initialShape?: { start: { x: number; y: number }; end: { x: number; y: number } };
    initialBlur?: { start: { x: number; y: number }; end: { x: number; y: number } };
    tempPath?: Array<{ x: number; y: number }>;
  }>;
  onPrev: () => void;
  onNext: () => void;
  onStagePointerDown: (e: React.PointerEvent) => void;
  onStagePointerMove: (e: React.PointerEvent) => void;
  onStagePointerUp: (e: React.PointerEvent) => void;
  onImageLoad: () => void;
  onVideoLoaded: (name: string) => void;
  drawCanvas: () => void;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingTextId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedBlurId: React.Dispatch<React.SetStateAction<string | null>>;
  setTextInputValue: React.Dispatch<React.SetStateAction<string>>;
  setTextInputActive: React.Dispatch<React.SetStateAction<boolean>>;
  setTextInputPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setCanvasEmojiAnchorEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  setActiveTool: React.Dispatch<React.SetStateAction<ToolMode>>;
  getNormalizedPoint: (e: React.PointerEvent) => { x: number; y: number } | null;
  updateCurrentState: (updater: (prev: ImageEditState) => ImageEditState, recordHistory?: boolean) => void;
}

/** Main media display stage with image, canvas overlay, annotations, and crop controls. */
export default function MediaPreviewStage({
  currentMedia,
  currentIndex,
  mediaFilesLength,
  isImage,
  isVideo,
  isFile,
  loadedVideos,
  activeTool,
  activeColor,
  activeFontFamily,
  activeTextBgMode,
  textInputActive,
  textInputValue,
  textInputPos,
  selectedElementId,
  editingTextId,
  selectedBlurId,
  hoveredFilter,
  currentState,
  titleColor,
  subtitleColor,
  borderColor,
  isDark,
  iconUrl,
  sizeText,
  extText,
  getMediaUrl,
  mediaStageRef,
  imgElementRef,
  annotationCanvasRef,
  pointerDragRef,
  onPrev,
  onNext,
  onStagePointerDown,
  onStagePointerMove,
  onStagePointerUp,
  onImageLoad,
  onVideoLoaded,
  setSelectedElementId,
  setEditingTextId,
  setSelectedBlurId,
  setTextInputValue,
  setTextInputActive,
  setTextInputPos,
  setCanvasEmojiAnchorEl,
  setActiveTool,
  getNormalizedPoint,
  updateCurrentState,
}: MediaPreviewStageProps) {
  const theme = useTheme();
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [textEmojiAnchorEl, setTextEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const textMeasureRef = useRef<HTMLSpanElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const [inputWidth, setInputWidth] = useState("auto");

  // Auto-size the text input to fit its content exactly
  useLayoutEffect(() => {
    const span = textMeasureRef.current;
    const textarea = textInputRef.current;
    if (!span) return;
    const text = textInputValue || "Type something";
    // Measure width using the longest line (for multi-line via Shift+Enter)
    const lines = text.split("\n");
    const longestLine = lines.reduce((a, b) => (a.length > b.length ? a : b), "Type something");
    span.textContent = longestLine || "Type something";
    // Input has padding 10*2=20 + border 2*2=4 = 24px. Add 12px buffer.
    const measured = span.offsetWidth + 36;
    setInputWidth(textInputValue ? `${measured}px` : "auto");
    // Auto-resize textarea height — only grows with actual newlines (Shift+Enter),
    // not from word wrapping (whiteSpace: nowrap prevents wrapping).
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [textInputValue]);

  useLayoutEffect(() => {
    const el = mediaStageRef.current;
    if (!el) return;
    const update = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mediaStageRef]);

  const rotation = currentState.rotation;
  const isRotated90 = rotation === 90 || rotation === 270;
  // When rotated 90/270, swap available width/height for image fitting
  const availW = isRotated90 ? stageSize.height : stageSize.width;
  const availH = isRotated90 ? stageSize.width : stageSize.height;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Previous image navigation arrow */}
      {mediaFilesLength > 1 && currentIndex > 0 && (
        <button
          onClick={onPrev}
          aria-label="Previous media"
          style={{
            position: "absolute",
            left: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${borderColor}`,
            background: isDark ? "rgba(30,30,42,0.92)" : "rgba(255,255,255,0.92)",
            color: titleColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 25,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Next image navigation arrow */}
      {mediaFilesLength > 1 && currentIndex < mediaFilesLength - 1 && (
        <button
          onClick={onNext}
          aria-label="Next media"
          style={{
            position: "absolute",
            right: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${borderColor}`,
            background: isDark ? "rgba(30,30,42,0.92)" : "rgba(255,255,255,0.92)",
            color: titleColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 25,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Stage Container */}
      <div
        ref={mediaStageRef}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          position: "relative",
        }}
      >
        {isImage && currentMedia && (
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              maxWidth: "100%",
              maxHeight: "100%",
              touchAction: "none",
              userSelect: "none",
              cursor: activeTool === "blur" ? "crosshair" : "default",
            }}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerCancel={onStagePointerUp}
          >
            {/* Rotating wrapper: image + canvas + all overlays rotate together */}
            <div
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `rotate(${currentState.rotation}deg)`,
                transformOrigin: "center",
                transition: "transform 0.25s ease",
                overflow: "hidden",
                borderRadius: 4,
              }}
            >
            {/* Base Image */}
            <img
              ref={imgElementRef}
              src={getMediaUrl(currentMedia)}
              alt={currentMedia.name || "media"}
              onLoad={onImageLoad}
              style={{
                maxWidth: availW > 0 ? `${availW}px` : "100%",
                maxHeight: availH > 0 ? `${availH}px` : "calc(100vh - 280px)",
                objectFit: "contain",
                display: "block",
                pointerEvents: "none",
                filter: getFilterCssString(hoveredFilter !== null ? hoveredFilter : currentState.filter),
                willChange: "filter",
              }}
            />

            {/* Drawing & Shape Canvas Overlay */}
            <canvas
              ref={annotationCanvasRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            />

            {/* Interactive Draggable Text Elements */}
            {currentState.texts.map((item) => {
              const isSel = selectedElementId === item.id;
              const isEditing = editingTextId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(item.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTextId(item.id);
                    setActiveTool("text");
                    setTextInputPos({ x: item.x, y: item.y });
                    setTextInputValue(item.text);
                    setTextInputActive(true);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(item.id);
                    pointerDragRef.current.isDown = true;
                    pointerDragRef.current.dragType = "move-element";
                    pointerDragRef.current.elementId = item.id;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  style={{
                    position: "absolute",
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    color: item.color,
                    // When editing, make the element invisible so only the
                    // unified white input shows at the same position.
                    background: isEditing ? "transparent" : item.bgMode === "none"
                        ? "transparent"
                        : item.color === "#ffffff" ? "#111827" : "#ffffff",
                    padding: "4px 10px",
                    borderRadius: 8,
                    fontSize: 20,
                    fontFamily:
                      item.fontFamily === "serif"
                        ? "Georgia, serif"
                        : item.fontFamily === "monospace"
                        ? "Courier New, monospace"
                        : item.fontFamily === "cursive"
                        ? "Pacifico, cursive"
                        : item.fontFamily === "impact"
                        ? "Impact, sans-serif"
                        : "sans-serif",
                    fontWeight: 450,
                    cursor: "move",
                    outline: isSel && !isEditing ? `2px dashed ${theme.palette.primary.main}` : "none",
                    boxShadow: isEditing ? "none" : item.bgMode === "none" ? "0 1px 4px rgba(0,0,0,0.8)" : "none",
                    userSelect: "none",
                    zIndex: 10,
                    whiteSpace: "pre-wrap",
                    textAlign: "center",
                    opacity: isEditing ? 0 : 1,
                  }}
                >
                  {isEditing ? "" : item.text}
                </div>
              );
            })}

            {/* WhatsApp-style Blur Region Overlay — move, resize, delete */}
            {activeTool === "blur" && currentState.blurRegions.map((region, idx) => {
              if (region.type !== "box" || !region.start || !region.end) return null;
              const x1 = Math.min(region.start.x, region.end.x);
              const y1 = Math.min(region.start.y, region.end.y);
              const x2 = Math.max(region.start.x, region.end.x);
              const y2 = Math.max(region.start.y, region.end.y);
              const blurId = `blur_${idx}`;
              const isSel = selectedBlurId === blurId;
              const handles: Array<{ pos: string; cursor: string; style: React.CSSProperties }> = [
                { pos: "nw", cursor: "nwse-resize", style: { top: -7, left: -7 } },
                { pos: "n",  cursor: "ns-resize",   style: { top: -7, left: "50%", transform: "translateX(-50%)" } },
                { pos: "ne", cursor: "nesw-resize", style: { top: -7, right: -7 } },
                { pos: "e",  cursor: "ew-resize",   style: { top: "50%", right: -7, transform: "translateY(-50%)" } },
                { pos: "se", cursor: "nwse-resize", style: { bottom: -7, right: -7 } },
                { pos: "s",  cursor: "ns-resize",   style: { bottom: -7, left: "50%", transform: "translateX(-50%)" } },
                { pos: "sw", cursor: "nesw-resize", style: { bottom: -7, left: -7 } },
                { pos: "w",  cursor: "ew-resize",   style: { top: "50%", left: -7, transform: "translateY(-50%)" } },
              ];
              return (
                <div
                  key={blurId}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBlurId(isSel ? null : blurId);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedBlurId(blurId);
                    const pt = getNormalizedPoint(e);
                    if (!pt) return;
                    pointerDragRef.current.isDown = true;
                    pointerDragRef.current.dragType = "blur-move";
                    pointerDragRef.current.elementId = blurId;
                    pointerDragRef.current.initialBlur = { start: region.start!, end: region.end! };
                    pointerDragRef.current.startPoint = pt;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  style={{
                    position: "absolute",
                    left: `${x1 * 100}%`,
                    top: `${y1 * 100}%`,
                    width: `${(x2 - x1) * 100}%`,
                    height: `${(y2 - y1) * 100}%`,
                    border: `2px solid ${isSel ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.5)}`,
                    boxShadow: isSel ? `0 0 0 1px ${theme.palette.primary.main}` : "none",
                    cursor: "move",
                    zIndex: 12,
                    boxSizing: "border-box",
                  }}
                >
                  {/* Resize handles — only show when selected */}
                  {isSel && handles.map((h) => (
                    <div
                      key={h.pos}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        pointerDragRef.current.isDown = true;
                        pointerDragRef.current.dragType = "blur-resize";
                        pointerDragRef.current.elementId = blurId;
                        pointerDragRef.current.blurHandle = h.pos;
                        pointerDragRef.current.initialBlur = { start: region.start!, end: region.end! };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      style={{
                        position: "absolute",
                        width: 14,
                        height: 14,
                        backgroundColor: "#fff",
                        border: `2px solid ${theme.palette.primary.main}`,
                        borderRadius: 3,
                        ...h.style,
                        cursor: h.cursor,
                        zIndex: 14,
                      }}
                    />
                  ))}

                  {/* Delete button for selected blur region */}
                  {isSel && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCurrentState((prev) => ({
                          ...prev,
                          blurRegions: prev.blurRegions.filter((_, i) => i !== idx),
                        }));
                        setSelectedBlurId(null);
                      }}
                      style={{
                        position: "absolute",
                        top: -28,
                        right: -2,
                        background: theme.palette.error.main,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        cursor: "pointer",
                        zIndex: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </div>
              );
            })}

            {/* Interactive Draggable Emojis */}
            {currentState.emojis.map((item) => {
              const isSel = selectedElementId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(item.id);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(item.id);
                    pointerDragRef.current.isDown = true;
                    pointerDragRef.current.dragType = "move-element";
                    pointerDragRef.current.elementId = item.id;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  style={{
                    position: "absolute",
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: item.size || 48,
                    cursor: "move",
                    outline: isSel ? `2px dashed ${theme.palette.primary.main}` : "none",
                    userSelect: "none",
                    zIndex: 10,
                  }}
                >
                  {item.emoji}
                </div>
              );
            })}

            {/* Interactive Shape Selection Overlays */}
            {currentState.shapes.map((shape) => {
              const isSel = selectedElementId === shape.id;
              if (!isSel && activeTool !== "shapes") return null;
              const x1 = Math.min(shape.start.x, shape.end.x);
              const y1 = Math.min(shape.start.y, shape.end.y);
              const x2 = Math.max(shape.start.x, shape.end.x);
              const y2 = Math.max(shape.start.y, shape.end.y);
              const handles = [
                { handle: "nw", cursor: "nwse-resize", left: -8, top: -8 },
                { handle: "n", cursor: "ns-resize", left: "50%", top: -8, transform: "translateX(-50%)" },
                { handle: "ne", cursor: "nesw-resize", right: -8, top: -8 },
                { handle: "e", cursor: "ew-resize", right: -8, top: "50%", transform: "translateY(-50%)" },
                { handle: "se", cursor: "nwse-resize", right: -8, bottom: -8 },
                { handle: "s", cursor: "ns-resize", left: "50%", bottom: -8, transform: "translateX(-50%)" },
                { handle: "sw", cursor: "nesw-resize", left: -8, bottom: -8 },
                { handle: "w", cursor: "ew-resize", left: -8, top: "50%", transform: "translateY(-50%)" },
              ];
              return (
                <div
                  key={shape.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const pt = getNormalizedPoint(e);
                    if (!pt) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setSelectedElementId(shape.id);
                    pointerDragRef.current.isDown = true;
                    pointerDragRef.current.dragType = "move-element";
                    pointerDragRef.current.elementId = shape.id;
                    pointerDragRef.current.startPoint = pt;
                    pointerDragRef.current.initialShape = { start: shape.start, end: shape.end };
                  }}
                  style={{
                    position: "absolute",
                    left: `${x1 * 100}%`,
                    top: `${y1 * 100}%`,
                    width: `${Math.max(0, x2 - x1) * 100}%`,
                    height: `${Math.max(0, y2 - y1) * 100}%`,
                    border: isSel ? `2px dashed ${theme.palette.primary.main}` : `1.5px dashed ${theme.palette.primary.main}`,
                    background: "transparent",
                    cursor: "move",
                    zIndex: 12,
                    pointerEvents: "auto",
                  }}
                >
                  {isSel && handles.map((h) => (
                    <div
                      key={h.handle}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const pt = getNormalizedPoint(e);
                        if (!pt) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setSelectedElementId(shape.id);
                        pointerDragRef.current.isDown = true;
                        pointerDragRef.current.dragType = "shape-handle";
                        pointerDragRef.current.elementId = shape.id;
                        pointerDragRef.current.cropHandle = h.handle;
                        pointerDragRef.current.startPoint = pt;
                        pointerDragRef.current.initialShape = { start: shape.start, end: shape.end };
                      }}
                      style={{
                        position: "absolute",
                        width: 16,
                        height: 16,
                        backgroundColor: "#fff",
                        border: `2px solid ${theme.palette.primary.main}`,
                        borderRadius: 3,
                        cursor: h.cursor,
                        left: h.left,
                        right: (h as any).right,
                        top: h.top,
                        bottom: (h as any).bottom,
                        transform: h.transform,
                        zIndex: 14,
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Interactive Crop Overlay */}
            {activeTool === "crop" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "auto",
                }}
              >
                {(() => {
                  const crop = currentState.crop || { x: 0, y: 0, width: 1, height: 1 };
                  return (
                    <>
                      {/* Dimmed backdrop outside crop area */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: "100%",
                          height: `${crop.y * 100}%`,
                          background: "rgba(0,0,0,0.6)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: `${(crop.y + crop.height) * 100}%`,
                          width: "100%",
                          height: `${(1 - (crop.y + crop.height)) * 100}%`,
                          background: "rgba(0,0,0,0.6)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: `${crop.y * 100}%`,
                          width: `${crop.x * 100}%`,
                          height: `${crop.height * 100}%`,
                          background: "rgba(0,0,0,0.6)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `${(crop.x + crop.width) * 100}%`,
                          top: `${crop.y * 100}%`,
                          width: `${(1 - (crop.x + crop.width)) * 100}%`,
                          height: `${crop.height * 100}%`,
                          background: "rgba(0,0,0,0.6)",
                        }}
                      />

                      {/* Crop Box Window */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const pt = getNormalizedPoint(e);
                          if (!pt) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          pointerDragRef.current.isDown = true;
                          pointerDragRef.current.dragType = "crop-move";
                          pointerDragRef.current.startPoint = pt;
                          pointerDragRef.current.initialCrop = crop;
                        }}
                        style={{
                          position: "absolute",
                          left: `${crop.x * 100}%`,
                          top: `${crop.y * 100}%`,
                          width: `${crop.width * 100}%`,
                          height: `${crop.height * 100}%`,
                          border: "2px solid #ffffff",
                          boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                          cursor: "move",
                        }}
                      >
                        {/* 3x3 Rule-of-Thirds Grid */}
                        <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.3)" }} />
                        <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.3)" }} />
                        <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.3)" }} />
                        <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.3)" }} />

                        {/* 8 Resize Handles */}
                        {[
                          { handle: "nw", cursor: "nwse-resize", left: -8, top: -8 },
                          { handle: "n", cursor: "ns-resize", left: "50%", top: -8, transform: "translateX(-50%)" },
                          { handle: "ne", cursor: "nesw-resize", right: -8, top: -8 },
                          { handle: "e", cursor: "ew-resize", right: -8, top: "50%", transform: "translateY(-50%)" },
                          { handle: "se", cursor: "nwse-resize", right: -8, bottom: -8 },
                          { handle: "s", cursor: "ns-resize", left: "50%", bottom: -8, transform: "translateX(-50%)" },
                          { handle: "sw", cursor: "nesw-resize", left: -8, bottom: -8 },
                          { handle: "w", cursor: "ew-resize", left: -8, top: "50%", transform: "translateY(-50%)" },
                        ].map((h) => (
                          <div
                            key={h.handle}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const pt = getNormalizedPoint(e);
                              if (!pt) return;
                              e.currentTarget.setPointerCapture(e.pointerId);
                              pointerDragRef.current.isDown = true;
                              pointerDragRef.current.dragType = "crop-handle";
                              pointerDragRef.current.cropHandle = h.handle;
                              pointerDragRef.current.startPoint = pt;
                              pointerDragRef.current.initialCrop = crop;
                            }}
                            style={{
                              position: "absolute",
                              width: 16,
                              height: 16,
                              backgroundColor: "#fff",
                              border: `2px solid ${theme.palette.primary.main}`,
                              borderRadius: 3,
                              cursor: h.cursor,
                              left: h.left,
                              right: (h as any).right,
                              top: h.top,
                              bottom: (h as any).bottom,
                              transform: h.transform,
                              zIndex: 15,
                            }}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            </div>
            {activeTool === "text" && textInputActive && (
              <div
                style={{
                  position: "absolute",
                  left: `${textInputPos.x * 100}%`,
                  top: `${textInputPos.y * 100}%`,
                  width: 0,
                  height: 0,
                  overflow: "visible",
                  zIndex: 30,
                  pointerEvents: "none",
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Emoji icon above the input */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (blurTimeoutRef.current) {
                      window.clearTimeout(blurTimeoutRef.current);
                      blurTimeoutRef.current = null;
                    }
                    setTextEmojiAnchorEl(e.currentTarget);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    background: "rgba(255,255,255,0.95)",
                    border: `1px solid ${theme.palette.primary.main}`,
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    opacity: 0.9,
                    padding: 6,
                    borderRadius: "50%",
                    transition: "transform 0.15s ease, opacity 0.15s ease",
                    color: activeColor,
                    pointerEvents: "auto",
                    position: "absolute",
                    bottom: "calc(100% + 20px)",
                    left: 0,
                    transform: "translateX(-50%)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateX(-50%) scale(1.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateX(-50%) scale(1)"; }}
                >
                  🙂
                </button>

                <EmojiPickerPopper
                  open={Boolean(textEmojiAnchorEl)}
                  anchorEl={textEmojiAnchorEl}
                  onEmojiClick={(data) => {
                    if (blurTimeoutRef.current) {
                      window.clearTimeout(blurTimeoutRef.current);
                      blurTimeoutRef.current = null;
                    }
                    const emoji = data.emoji;
                    const input = textInputRef.current;
                    if (input) {
                      const start = input.selectionStart ?? textInputValue.length;
                      const end = input.selectionEnd ?? start;
                      const before = textInputValue.slice(0, start);
                      const after = textInputValue.slice(end);
                      const next = before + emoji + after;
                      setTextInputValue(next);
                      window.requestAnimationFrame(() => {
                        input.focus();
                        const pos = start + emoji.length;
                        input.setSelectionRange(pos, pos);
                      });
                    } else {
                      setTextInputValue((prev) => prev + emoji);
                    }
                    setTextEmojiAnchorEl(null);
                  }}
                  onClose={() => setTextEmojiAnchorEl(null)}
                  darkMode={isDark}
                />

                <textarea
                  ref={textInputRef}
                  autoFocus
                  placeholder="Type something"
                  value={textInputValue}
                  onChange={(e) => setTextInputValue(e.target.value)}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      const trimmed = textInputValue.trim();
                      if (trimmed) {
                        if (editingTextId) {
                          updateCurrentState((prev) => ({
                            ...prev,
                            texts: prev.texts.map((t) =>
                              t.id === editingTextId
                                ? { ...t, text: trimmed, color: activeColor, fontFamily: activeFontFamily, bgMode: activeTextBgMode }
                                : t
                            ),
                          }));
                          setEditingTextId(null);
                        } else {
                          const newId = `txt_${Date.now()}`;
                          updateCurrentState((prev) => ({
                            ...prev,
                            texts: [
                              ...prev.texts,
                              {
                                id: newId,
                                text: trimmed,
                                x: textInputPos.x,
                                y: textInputPos.y,
                                color: activeColor,
                                fontFamily: activeFontFamily,
                                bgMode: activeTextBgMode,
                                fontSize: 20,
                              },
                            ],
                          }));
                        }
                      }
                      setTextInputActive(false);
                      setTextInputValue("");
                      setActiveTool("none");
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setTextInputActive(false);
                      setTextInputValue("");
                      setEditingTextId(null);
                    }
                  }}
                  onBlur={() => {
                    if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
                    blurTimeoutRef.current = window.setTimeout(() => {
                      blurTimeoutRef.current = null;
                      if (textEmojiAnchorEl) return;
                      const trimmed = textInputValue.trim();
                      if (trimmed) {
                        if (editingTextId) {
                          updateCurrentState((prev) => ({
                            ...prev,
                            texts: prev.texts.map((t) =>
                              t.id === editingTextId
                                ? { ...t, text: trimmed, color: activeColor, fontFamily: activeFontFamily, bgMode: activeTextBgMode }
                                : t
                            ),
                          }));
                          setEditingTextId(null);
                        } else {
                          const newId = `txt_${Date.now()}`;
                          updateCurrentState((prev) => ({
                            ...prev,
                            texts: [
                              ...prev.texts,
                              {
                                id: newId,
                                text: trimmed,
                                x: textInputPos.x,
                                y: textInputPos.y,
                                color: activeColor,
                                fontFamily: activeFontFamily,
                                bgMode: activeTextBgMode,
                                fontSize: 20,
                              },
                            ],
                          }));
                        }
                      }
                      setTextInputActive(false);
                      setTextInputValue("");
                      setActiveTool("none");
                    }, 150);
                  }}
                  style={{
                    background: "#ffffff",
                    border: `2px solid ${theme.palette.primary.main}`,
                    borderRadius: 6,
                    color: activeColor,
                    fontSize: 20,
                    fontFamily:
                      activeFontFamily === "serif" ? "Georgia, serif"
                      : activeFontFamily === "monospace" ? "Courier New, monospace"
                      : activeFontFamily === "cursive" ? "Pacifico, cursive"
                      : activeFontFamily === "impact" ? "Impact, sans-serif"
                      : "sans-serif",
                    fontWeight: 450,
                    padding: "4px 10px",
                    outline: "none",
                    width: inputWidth,
                    maxWidth: "80vw",
                    textAlign: "center",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
                    resize: "none",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    lineHeight: 1.3,
                    display: "block",
                    pointerEvents: "auto",
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: "translate(-50%, -50%)",
                  }}
                />
                {/* Hidden measuring span for auto-sizing the input */}
                <span
                  ref={textMeasureRef}
                  style={{
                    position: "absolute",
                    visibility: "hidden",
                    whiteSpace: "pre",
                    fontSize: 20,
                    fontFamily:
                      activeFontFamily === "serif" ? "Georgia, serif"
                      : activeFontFamily === "monospace" ? "Courier New, monospace"
                      : activeFontFamily === "cursive" ? "Pacifico, cursive"
                      : activeFontFamily === "impact" ? "Impact, sans-serif"
                      : "sans-serif",
                    fontWeight: 450,
                    left: 0,
                    top: 0,
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {isVideo && currentMedia && (
          <>
            {!loadedVideos.has(currentMedia.name) && (
              <Skeleton
                variant="rectangular"
                width="100%"
                height="100%"
                animation="wave"
                sx={{
                  bgcolor: "rgba(0,0,0,0.05)",
                  position: "absolute",
                  inset: 0,
                  borderRadius: "12px",
                }}
              />
            )}
            <video
              src={getMediaUrl(currentMedia)}
              controls
              onLoadedData={() => onVideoLoaded(currentMedia!.name)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: loadedVideos.has(currentMedia.name) ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
            />
          </>
        )}

        {isFile && currentMedia && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
              color: subtitleColor,
              padding: 20,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              {iconUrl ? (
                <img src={iconUrl} alt="" style={{ width: 80, height: 80, objectFit: "contain" }} />
              ) : (
                <FileText size={80} color={theme.palette.primary.main} />
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: 16, color: titleColor, marginBottom: 4 }}>
              {currentMedia.name}
            </div>
            <div style={{ fontSize: 13, color: subtitleColor }}>
              {sizeText} · {extText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
