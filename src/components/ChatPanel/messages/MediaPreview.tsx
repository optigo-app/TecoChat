"use client";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { useTheme } from "@mui/material";
import DragDropOverlay from "../../DragDropOverlay/DragDropOverlay";
import {
  CLEAR_EDITOR_COMMAND,
  $getSelection,
  $isRangeSelection,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type LexicalEditor,
} from "lexical";
import type { MediaFileItem } from "../CoreLogic/uiReducer";
import { getDocumentMeta } from "../../../utils/globalFunc";

import type {
  TextBgMode,
  TextElement,
  EmojiElement,
  CropRect,
  FilterType,
  ImageEditState,
  MediaPreviewProps,
  ToolMode,
  ShapeElement,
} from "./MediaPreviewEditor/types";
export type {
  DrawingPath,
  ShapeElement,
  TextBgMode,
  TextElement,
  BlurRegion,
  EmojiElement,
  CropRect,
  FilterType,
  ImageEditState,
  MediaPreviewProps,
  ToolMode,
} from "./MediaPreviewEditor/types";
import {
  WA_COLORS,
  STROKE_SIZES,
  formatSize,
  getExt,
  createDefaultEditState,
} from "./MediaPreviewEditor/constants";
export { FILTERS } from "./MediaPreviewEditor/constants";
import { useMediaEditHistory, useKeyboardShortcuts } from "./MediaPreviewEditor/hooks";
import {
  applyInteractiveBlur,
  applyInteractiveBlurPath,
  applyPixelateBox,
  applyPixelatePath,
  intensityToBlockSize,
  renderEditedImage,
  hasImageEdits,
  drawArrowOnCanvas,
} from "./MediaPreviewEditor/canvasRender";
import MediaPreviewHeader from "./MediaPreviewEditor/MediaPreviewHeader";
import { MediaPreviewFilterBar, MediaPreviewToolControls } from "./MediaPreviewEditor/MediaPreviewToolBars";
import MediaPreviewPopovers from "./MediaPreviewEditor/MediaPreviewPopovers";
import MediaPreviewStage from "./MediaPreviewEditor/MediaPreviewStage";
import MediaPreviewThumbnails from "./MediaPreviewEditor/MediaPreviewThumbnails";
import MediaPreviewCaptionBar from "./MediaPreviewEditor/MediaPreviewCaptionBar";
import ConfirmationDialog from "../../ReusableComponent/ConfirmationDialog";

const MediaPreviewComponent = ({
  open,
  mediaFiles,
  onClose,
  onSend,
  onRemoveMedia,
  onUpdateMedia,
  onAddMore,
  syncKey,
}: MediaPreviewProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Navigation & Caption State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set());
  const [showCaptionEmoji, setShowCaptionEmoji] = useState(false);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [hoveredFilter, setHoveredFilter] = useState<FilterType | null>(null);

  // Active Tool & Settings
  const [activeTool, setActiveTool] = useState<ToolMode>("none");
  const [activeColor, setActiveColor] = useState("#000000");
  const [activeFillColor, setActiveFillColor] = useState<string | null>(null);
  const [activeStrokeSize, setActiveStrokeSize] = useState(STROKE_SIZES[1].value);
  const [activeShapeType, setActiveShapeType] = useState<"rect" | "circle" | "line" | "arrow">("rect");
  const [activeFontFamily, setActiveFontFamily] = useState<TextElement["fontFamily"]>("system");
  const [activeTextBgMode, setActiveTextBgMode] = useState<TextBgMode>("solid");
  const [activeBlurMode, setActiveBlurMode] = useState<"path" | "box">("box");
  const [activeBlurSize, setActiveBlurSize] = useState(50);
  const [activeBlurStyle, setActiveBlurStyle] = useState<"pixelate" | "smooth">("pixelate");
  const [selectedCropAspect, setSelectedCropAspect] = useState<string>("free");

  // Selection & Interactive Dragging
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Popover Anchors
  const [shapesAnchorEl, setShapesAnchorEl] = useState<HTMLElement | null>(null);
  const [canvasEmojiAnchorEl, setCanvasEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [textInputActive, setTextInputActive] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [textInputPos, setTextInputPos] = useState({ x: 0.5, y: 0.5 });
  const [selectedBlurId, setSelectedBlurId] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const textRef = useRef("");
  const captionEmojiBtnRef = useRef<HTMLButtonElement | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const thumbsScrollRef = useRef<HTMLDivElement | null>(null);
  const thumbItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mediaStageRef = useRef<HTMLDivElement | null>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgElementRef = useRef<HTMLImageElement | null>(null);

  // Pointer drag tracking
  const pointerDragRef = useRef<{
    isDown: boolean;
    startPoint: { x: number; y: number };
    currentPoint: { x: number; y: number };
    dragType: "draw" | "shape" | "blur" | "move-element" | "crop-handle" | "crop-move" | "shape-handle" | "blur-move" | "blur-resize" | "emoji-resize" | null;
    elementId?: string;
    cropHandle?: string;
    blurHandle?: string;
    initialCrop?: CropRect;
    initialShape?: { start: { x: number; y: number }; end: { x: number; y: number } };
    initialBlur?: { start: { x: number; y: number }; end: { x: number; y: number } };
    initialEmojiSize?: number;
    initialPos?: { x: number; y: number };
    tempPath?: Array<{ x: number; y: number }>;
  }>({
    isDown: false,
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    dragType: null,
  });

  // Current media and per-item edit history are isolated in a dedicated hook.
  const currentMedia = mediaFiles[currentIndex];
  const { editStates, currentState, updateCurrentState, canUndo, canRedo, handleUndo, handleRedo, reset: resetEditHistory, resetCurrent } = useMediaEditHistory(currentIndex);

  // Reset state when opening or switching conversation
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setCaption("");
      textRef.current = "";
      setLoadedVideos(new Set());
      setActiveTool("none");
      setSelectedElementId(null);
      setEditingTextId(null);
      setHoveredFilter(null);
      resetEditHistory();
      if (editorRef.current) {
        editorRef.current.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
      }
    }
  }, [open, syncKey, resetEditHistory]);

  // Reset tool selection when switching thumbnail
  useEffect(() => {
    setSelectedElementId(null);
    setEditingTextId(null);
    setHoveredFilter(null);
  }, [currentIndex]);

  // Track caption text from Lexical editor
  const handleEditorChange = useCallback((val: string) => {
    textRef.current = val;
    setCaption(val);
  }, []);

  // Focus editor on open
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => editorRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Auto-scroll thumbnail strip
  useEffect(() => {
    const el = thumbItemRefs.current[currentIndex];
    if (!el || !thumbsScrollRef.current) return;
    const container = thumbsScrollRef.current;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    if (elLeft < viewLeft) {
      container.scrollTo({ left: elLeft - 8, behavior: "smooth" });
    } else if (elRight > viewRight) {
      container.scrollTo({ left: elRight - container.clientWidth + 8, behavior: "smooth" });
    }
  }, [currentIndex]);

  // Mouse wheel scroll for thumbnails
  useEffect(() => {
    const container = thumbsScrollRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // Keyboard shortcuts
  const handleSendRef = useRef<() => void>(() => {});
  const handleCopyRef = useRef<() => void>(() => {});
  const handleApplyCropRef = useRef<() => void>(() => {});

  // Close confirmation — show dialog if there are media files or unsaved edits
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const requestClose = useCallback(() => {
    if (closeConfirmOpen || resetConfirmOpen) return;
    if (mediaFiles.length > 0 || hasImageEdits(currentState)) {
      setCloseConfirmOpen(true);
    } else {
      onClose();
    }
  }, [closeConfirmOpen, resetConfirmOpen, mediaFiles.length, currentState, onClose]);
  const confirmClose = useCallback(() => {
    setCloseConfirmOpen(false);
    onClose();
  }, [onClose]);

  useKeyboardShortcuts({
    open,
    activeTool,
    textInputActive,
    selectedElementId,
    showKeyboardHelp,
    mediaFilesLength: mediaFiles.length,
    onClose: requestClose,
    handleUndo,
    handleRedo,
    onSend: () => handleSendRef.current(),
    onApplyCrop: () => handleApplyCropRef.current(),
    updateCurrentState,
    setActiveTool,
    setSelectedElementId,
    setShowKeyboardHelp,
    setCurrentIndex,
    setCanvasEmojiAnchorEl,
    mediaStageRef,
    onCopy: () => handleCopyRef.current(),
  });

  // ── Normalized coordinate calculation ──
  const getNormalizedPoint = useCallback((event: React.PointerEvent) => {
    const stage = mediaStageRef.current;
    const img = imgElementRef.current;
    if (!stage || !img) return null;

    const imgRect = img.getBoundingClientRect();
    if (!imgRect.width || !imgRect.height) return null;

    // Visual-space normalized coordinates (relative to the rotated image's visual bounding box)
    const vx = (event.clientX - imgRect.left) / imgRect.width;
    const vy = (event.clientY - imgRect.top) / imgRect.height;

    // Transform visual-space coordinates to unrotated-space coordinates
    // based on the current rotation (0, 90, 180, 270 degrees CW)
    const rotation = currentState.rotation;
    let nx: number, ny: number;
    if (rotation === 90) {
      nx = vy;
      ny = 1 - vx;
    } else if (rotation === 180) {
      nx = 1 - vx;
      ny = 1 - vy;
    } else if (rotation === 270) {
      nx = 1 - vy;
      ny = vx;
    } else {
      nx = vx;
      ny = vy;
    }

    return {
      x: Math.max(0, Math.min(1, nx)),
      y: Math.max(0, Math.min(1, ny)),
    };
  }, [currentState.rotation]);

  // ── Canvas Real-time Rendering ──
  const drawCanvas = useCallback(() => {
    const canvas = annotationCanvasRef.current;
    const img = imgElementRef.current;
    if (!canvas || !img) return;

    const width = Math.round(img.offsetWidth);
    const height = Math.round(img.offsetHeight);
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Mosaic / Smooth Blur — with per-region intensity and style
    for (const blur of currentState.blurRegions) {
      const intensity = blur.intensity ?? 50;
      const blockSize = intensityToBlockSize(intensity, width);
      if (blur.type === "box" && blur.start && blur.end) {
        const bx = Math.min(blur.start.x, blur.end.x) * width;
        const by = Math.min(blur.start.y, blur.end.y) * height;
        const bw = Math.abs(blur.end.x - blur.start.x) * width;
        const bh = Math.abs(blur.end.y - blur.start.y) * height;
        if (blur.style === "smooth") {
          applyInteractiveBlur(ctx, img, bx, by, bw, bh, Math.max(4, Math.round(intensity * 0.35)));
        } else {
          applyPixelateBox(ctx, bx, by, bw, bh, blockSize, img);
        }
      } else if (blur.type === "path" && blur.points) {
        const bSize = (blur.size || 24) * (width / 800);
        applyPixelatePath(ctx, blur.points, width, height, bSize, Math.max(4, Math.round(bSize / 2.5)), img);
      }
    }

    // 2. Completed Drawings (Pen & Marker)
    for (const draw of currentState.drawings) {
      if (draw.points.length < 2) continue;
      ctx.save();
      if (draw.isMarker) {
        ctx.globalAlpha = 0.45;
        ctx.lineCap = "square";
        ctx.lineJoin = "bevel";
      } else {
        ctx.globalAlpha = 1.0;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      ctx.strokeStyle = draw.color;
      ctx.lineWidth = Math.max(2, draw.size * (width / 800));
      ctx.beginPath();
      draw.points.forEach((pt, idx) => {
        const px = pt.x * width;
        const py = pt.y * height;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }

    // In-progress drawing
    if (
      pointerDragRef.current.isDown &&
      pointerDragRef.current.dragType === "draw" &&
      pointerDragRef.current.tempPath &&
      pointerDragRef.current.tempPath.length > 1
    ) {
      ctx.save();
      const isM = activeTool === "marker";
      if (isM) {
        ctx.globalAlpha = 0.45;
        ctx.lineCap = "square";
        ctx.lineJoin = "bevel";
      } else {
        ctx.globalAlpha = 1.0;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = Math.max(2, activeStrokeSize * (width / 800));
      ctx.beginPath();
      pointerDragRef.current.tempPath.forEach((pt, idx) => {
        const px = pt.x * width;
        const py = pt.y * height;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 3. Completed Shapes
    for (const shape of currentState.shapes) {
      const sx = shape.start.x * width;
      const sy = shape.start.y * height;
      const ex = shape.end.x * width;
      const ey = shape.end.y * height;
      const sWidth = Math.max(2, shape.strokeWidth * (width / 800));

      ctx.strokeStyle = shape.color;
      ctx.lineWidth = sWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (shape.type === "rect") {
        const x = Math.min(sx, ex);
        const y = Math.min(sy, ey);
        const w = Math.abs(ex - sx);
        const h = Math.abs(ey - sy);
        if (shape.fillColor) {
          ctx.fillStyle = shape.fillColor;
          ctx.fillRect(x, y, w, h);
        }
        ctx.strokeRect(x, y, w, h);
      } else if (shape.type === "circle") {
        const cx = (sx + ex) / 2;
        const cy = (sy + ey) / 2;
        const rx = Math.max(1, Math.abs(ex - sx) / 2);
        const ry = Math.max(1, Math.abs(ey - sy) / 2);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        if (shape.fillColor) {
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        ctx.stroke();
      } else if (shape.type === "line") {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else if (shape.type === "arrow") {
        drawArrowOnCanvas(ctx, sx, sy, ex, ey, shape.color, sWidth, shape.fillColor ?? undefined);
      }
    }

    // In-progress shape
    if (
      pointerDragRef.current.isDown &&
      pointerDragRef.current.dragType === "shape"
    ) {
      const sx = pointerDragRef.current.startPoint.x * width;
      const sy = pointerDragRef.current.startPoint.y * height;
      const ex = pointerDragRef.current.currentPoint.x * width;
      const ey = pointerDragRef.current.currentPoint.y * height;
      const sWidth = Math.max(2, activeStrokeSize * (width / 800));

      ctx.strokeStyle = activeColor;
      ctx.lineWidth = sWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (activeShapeType === "rect") {
        const x = Math.min(sx, ex);
        const y = Math.min(sy, ey);
        const w = Math.abs(ex - sx);
        const h = Math.abs(ey - sy);
        if (activeFillColor) {
          ctx.fillStyle = activeFillColor;
          ctx.fillRect(x, y, w, h);
        }
        ctx.strokeRect(x, y, w, h);
      } else if (activeShapeType === "circle") {
        const cx = (sx + ex) / 2;
        const cy = (sy + ey) / 2;
        const rx = Math.max(1, Math.abs(ex - sx) / 2);
        const ry = Math.max(1, Math.abs(ey - sy) / 2);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        if (activeFillColor) {
          ctx.fillStyle = activeFillColor;
          ctx.fill();
        }
        ctx.stroke();
      } else if (activeShapeType === "line") {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else if (activeShapeType === "arrow") {
        drawArrowOnCanvas(ctx, sx, sy, ex, ey, activeColor, sWidth, activeFillColor ?? undefined);
      }
    }

    // In-progress path blur: render one clipped source-image pass per frame.
    if (
      pointerDragRef.current.isDown &&
      pointerDragRef.current.dragType === "blur" &&
      activeBlurMode === "path" &&
      pointerDragRef.current.tempPath?.length
    ) {
      const blurSize = activeBlurSize * (width / 800);
      applyInteractiveBlurPath(ctx, img, pointerDragRef.current.tempPath, width, height, blurSize, Math.max(4, blurSize / 2.5));
    }

    // In-progress Box Blur: live pixelation + selection outline during drag
    if (
      pointerDragRef.current.isDown &&
      pointerDragRef.current.dragType === "blur" &&
      activeBlurMode === "box"
    ) {
      const bsx = pointerDragRef.current.startPoint.x * width;
      const bsy = pointerDragRef.current.startPoint.y * height;
      const bex = pointerDragRef.current.currentPoint.x * width;
      const bey = pointerDragRef.current.currentPoint.y * height;
      const lx = Math.min(bsx, bex);
      const ly = Math.min(bsy, bey);
      const lw = Math.abs(bex - bsx);
      const lh = Math.abs(bey - bsy);
      if (lw > 4 && lh > 4) {
        const blockSize = intensityToBlockSize(activeBlurSize, width);
        applyPixelateBox(ctx, lx, ly, lw, lh, blockSize, img);
        ctx.save();
        ctx.strokeStyle = theme.palette.primary.main;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(lx, ly, lw, lh);
        ctx.restore();
      }
    }
  }, [currentState, activeColor, activeStrokeSize, activeShapeType, activeTool, activeBlurMode, activeBlurSize, theme]);

  useEffect(() => {
    drawCanvas();
    const handleResize = () => drawCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawCanvas, currentIndex, activeTool]);

  // ── Pointer Event Handlers for Image Stage ──
  const handleStagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "text" && textInputActive) return;
      if (activeTool === "none") return;
      const pt = getNormalizedPoint(e);
      if (!pt) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      pointerDragRef.current.isDown = true;
      pointerDragRef.current.startPoint = pt;
      pointerDragRef.current.currentPoint = pt;

      if (activeTool === "pen" || activeTool === "marker") {
        pointerDragRef.current.dragType = "draw";
        pointerDragRef.current.tempPath = [pt];
      } else if (activeTool === "shapes") {
        // If there's already a selected shape, clicking empty canvas deselects it
        // (clicking on a shape is handled by the shape's own onClick in the Stage).
        // Only add a new shape if there are no shapes yet.
        const hasShapes = currentState.shapes.length > 0;
        if (hasShapes) {
          // Deselect — user can click a shape to select/move/resize it
          setSelectedElementId(null);
          pointerDragRef.current.isDown = false;
          return;
        }
        // No shapes yet → create a default centered shape at the click point
        const newShape: ShapeElement = {
          id: `shape_${Date.now()}`,
          type: activeShapeType,
          start: { x: Math.max(0.05, pt.x - 0.15), y: Math.max(0.05, pt.y - 0.15) },
          end: { x: Math.min(0.95, pt.x + 0.15), y: Math.min(0.95, pt.y + 0.15) },
          color: activeColor,
          strokeWidth: activeStrokeSize,
          fillColor: activeFillColor,
        };
        updateCurrentState((prev) => ({
          ...prev,
          shapes: [...prev.shapes, newShape],
        }));
        setSelectedElementId(newShape.id);
        pointerDragRef.current.dragType = "move-element";
        pointerDragRef.current.elementId = newShape.id;
        pointerDragRef.current.initialShape = { start: newShape.start, end: newShape.end };
      } else if (activeTool === "blur") {
        pointerDragRef.current.dragType = "blur";
        if (activeBlurMode === "path") {
          pointerDragRef.current.tempPath = [pt];
        }
      } else if (activeTool === "text") {
        setTextInputPos(pt);
        setEditingTextId(null);
        if (!textInputActive) {
          setTextInputValue("");
          setTextInputActive(true);
        }
      }
    },
    [
      activeTool,
      activeShapeType,
      activeColor,
      activeFillColor,
      activeStrokeSize,
      getNormalizedPoint,
      activeBlurMode,
      textInputActive,
      updateCurrentState,
      setEditingTextId,
      currentState.shapes,
    ]
  );

  const handleStagePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerDragRef.current.isDown) return;
      const pt = getNormalizedPoint(e);
      if (!pt) return;

      pointerDragRef.current.currentPoint = pt;

      if (pointerDragRef.current.dragType === "draw") {
        pointerDragRef.current.tempPath?.push(pt);
        drawCanvas();
      } else if (pointerDragRef.current.dragType === "shape") {
        drawCanvas();
      } else if (pointerDragRef.current.dragType === "blur") {
        if (activeBlurMode === "path") {
          pointerDragRef.current.tempPath?.push(pt);
        }
        drawCanvas();
      } else if (pointerDragRef.current.dragType === "move-element" && pointerDragRef.current.elementId) {
        const id = pointerDragRef.current.elementId;
        const initShape = pointerDragRef.current.initialShape;
        if (initShape) {
          const dx = pt.x - pointerDragRef.current.startPoint.x;
          const dy = pt.y - pointerDragRef.current.startPoint.y;
          updateCurrentState((prev) => ({
            ...prev,
            shapes: prev.shapes.map((s) =>
              s.id === id
                ? {
                    ...s,
                    start: { x: initShape.start.x + dx, y: initShape.start.y + dy },
                    end: { x: initShape.end.x + dx, y: initShape.end.y + dy },
                  }
                : s
            ),
          }), false);
        } else {
          // Use drag offset so element doesn't snap to cursor center
          const startPt = pointerDragRef.current.startPoint;
          const initPos = pointerDragRef.current.initialPos;
          if (startPt && initPos) {
            const dx = pt.x - startPt.x;
            const dy = pt.y - startPt.y;
            const newX = Math.max(0, Math.min(1, initPos.x + dx));
            const newY = Math.max(0, Math.min(1, initPos.y + dy));
            updateCurrentState((prev) => ({
              ...prev,
              texts: prev.texts.map((t) => (t.id === id ? { ...t, x: newX, y: newY } : t)),
              emojis: prev.emojis.map((m) => (m.id === id ? { ...m, x: newX, y: newY } : m)),
            }), false);
          } else {
            updateCurrentState((prev) => ({
              ...prev,
              texts: prev.texts.map((t) => (t.id === id ? { ...t, x: pt.x, y: pt.y } : t)),
              emojis: prev.emojis.map((m) => (m.id === id ? { ...m, x: pt.x, y: pt.y } : m)),
            }), false);
          }
        }
      } else if (
        pointerDragRef.current.dragType === "shape-handle" &&
        pointerDragRef.current.elementId &&
        pointerDragRef.current.initialShape &&
        pointerDragRef.current.cropHandle
      ) {
        const id = pointerDragRef.current.elementId;
        const init = pointerDragRef.current.initialShape;
        const handle = pointerDragRef.current.cropHandle;
        let nx1 = init.start.x;
        let ny1 = init.start.y;
        let nx2 = init.end.x;
        let ny2 = init.end.y;

        if (handle.includes("w")) nx1 = Math.max(0, Math.min(nx2 - 0.05, pt.x));
        if (handle.includes("e")) nx2 = Math.max(nx1 + 0.05, Math.min(1, pt.x));
        if (handle.includes("n")) ny1 = Math.max(0, Math.min(ny2 - 0.05, pt.y));
        if (handle.includes("s")) ny2 = Math.max(ny1 + 0.05, Math.min(1, pt.y));

        updateCurrentState((prev) => ({
          ...prev,
          shapes: prev.shapes.map((s) =>
            s.id === id ? { ...s, start: { x: nx1, y: ny1 }, end: { x: nx2, y: ny2 } } : s
          ),
        }), false);
      } else if (
        pointerDragRef.current.dragType === "crop-handle" &&
        pointerDragRef.current.initialCrop &&
        pointerDragRef.current.cropHandle
      ) {
        const handle = pointerDragRef.current.cropHandle;
        const init = pointerDragRef.current.initialCrop;
        const dx = pt.x - pointerDragRef.current.startPoint.x;
        const dy = pt.y - pointerDragRef.current.startPoint.y;

        let nx = init.x;
        let ny = init.y;
        let nw = init.width;
        let nh = init.height;

        if (handle.includes("w")) {
          nx = Math.min(init.x + dx, init.x + init.width - 0.05);
          nw = init.width - (nx - init.x);
        }
        if (handle.includes("e")) {
          nw = Math.max(0.05, init.width + dx);
        }
        if (handle.includes("n")) {
          ny = Math.min(init.y + dy, init.y + init.height - 0.05);
          nh = init.height - (ny - init.y);
        }
        if (handle.includes("s")) {
          nh = Math.max(0.05, init.height + dy);
        }

        nx = Math.max(0, Math.min(1 - nw, nx));
        ny = Math.max(0, Math.min(1 - nh, ny));
        nw = Math.max(0.05, Math.min(1 - nx, nw));
        nh = Math.max(0.05, Math.min(1 - ny, nh));

        updateCurrentState((prev) => ({
          ...prev,
          crop: { x: nx, y: ny, width: nw, height: nh },
        }), false);
      } else if (
        pointerDragRef.current.dragType === "crop-move" &&
        pointerDragRef.current.initialCrop
      ) {
        const init = pointerDragRef.current.initialCrop;
        const dx = pt.x - pointerDragRef.current.startPoint.x;
        const dy = pt.y - pointerDragRef.current.startPoint.y;

        const nx = Math.max(0, Math.min(1 - init.width, init.x + dx));
        const ny = Math.max(0, Math.min(1 - init.height, init.y + dy));

        updateCurrentState((prev) => ({
          ...prev,
          crop: { ...init, x: nx, y: ny },
        }), false);
      } else if (
        pointerDragRef.current.dragType === "blur-move" &&
        pointerDragRef.current.elementId &&
        pointerDragRef.current.initialBlur
      ) {
        const blurIdx = parseInt(pointerDragRef.current.elementId.replace("blur_", ""), 10);
        const init = pointerDragRef.current.initialBlur;
        const dx = pt.x - pointerDragRef.current.startPoint.x;
        const dy = pt.y - pointerDragRef.current.startPoint.y;
        updateCurrentState((prev) => ({
          ...prev,
          blurRegions: prev.blurRegions.map((b, i) =>
            i === blurIdx
              ? {
                  ...b,
                  start: { x: Math.max(0, Math.min(1, init.start.x + dx)), y: Math.max(0, Math.min(1, init.start.y + dy)) },
                  end: { x: Math.max(0, Math.min(1, init.end.x + dx)), y: Math.max(0, Math.min(1, init.end.y + dy)) },
                }
              : b
          ),
        }), false);
        drawCanvas();
      } else if (
        pointerDragRef.current.dragType === "blur-resize" &&
        pointerDragRef.current.elementId &&
        pointerDragRef.current.initialBlur &&
        pointerDragRef.current.blurHandle
      ) {
        const blurIdx = parseInt(pointerDragRef.current.elementId.replace("blur_", ""), 10);
        const init = pointerDragRef.current.initialBlur;
        const handle = pointerDragRef.current.blurHandle;
        let nx1 = init.start.x;
        let ny1 = init.start.y;
        let nx2 = init.end.x;
        let ny2 = init.end.y;
        if (handle.includes("w")) nx1 = Math.max(0, Math.min(0.95, pt.x));
        if (handle.includes("e")) nx2 = Math.max(0.05, Math.min(1, pt.x));
        if (handle.includes("n")) ny1 = Math.max(0, Math.min(0.95, pt.y));
        if (handle.includes("s")) ny2 = Math.max(0.05, Math.min(1, pt.y));
        updateCurrentState((prev) => ({
          ...prev,
          blurRegions: prev.blurRegions.map((b, i) =>
            i === blurIdx ? { ...b, start: { x: nx1, y: ny1 }, end: { x: nx2, y: ny2 } } : b
          ),
        }), false);
        drawCanvas();
      } else if (
        pointerDragRef.current.dragType === "emoji-resize" &&
        pointerDragRef.current.elementId &&
        pointerDragRef.current.initialEmojiSize != null
      ) {
        const id = pointerDragRef.current.elementId;
        const initSize = pointerDragRef.current.initialEmojiSize;
        const startPt = pointerDragRef.current.startPoint;
        // Use signed scalar: dragging down-right increases, up-left decreases
        const delta = (pt.x - startPt.x) + (pt.y - startPt.y);
        const newSize = Math.max(20, Math.min(200, Math.round(initSize * (1 + delta * 2))));
        updateCurrentState((prev) => ({
          ...prev,
          emojis: prev.emojis.map((m) => (m.id === id ? { ...m, size: newSize } : m)),
        }), false);
      }
    },
    [getNormalizedPoint, drawCanvas, activeBlurMode, updateCurrentState]
  );

  const handleStagePointerUp = useCallback(() => {
    if (!pointerDragRef.current.isDown) return;
    const { dragType, startPoint, currentPoint, tempPath } = pointerDragRef.current;
    pointerDragRef.current.isDown = false;

    if (dragType === "draw" && tempPath && tempPath.length > 1) {
      updateCurrentState((prev) => ({
        ...prev,
        drawings: [
          ...prev.drawings,
          {
            points: tempPath,
            color: activeColor,
            size: activeStrokeSize,
            isMarker: activeTool === "marker",
          },
        ],
      }));
    } else if (dragType === "blur") {
      if (activeBlurMode === "path" && tempPath && tempPath.length > 0) {
        updateCurrentState((prev) => ({
          ...prev,
          blurRegions: [
            ...prev.blurRegions,
            { type: "path", points: tempPath, size: activeBlurSize, intensity: activeBlurSize },
          ],
        }));
      } else if (activeBlurMode === "box") {
        updateCurrentState((prev) => ({
          ...prev,
          blurRegions: [
            ...prev.blurRegions,
            { type: "box", start: startPoint, end: currentPoint, intensity: activeBlurSize },
          ],
        }));
      }
    } else if (dragType === "move-element" || dragType === "shape-handle" || dragType === "crop-handle" || dragType === "crop-move" || dragType === "blur-move" || dragType === "blur-resize" || dragType === "emoji-resize") {
      // History was already recorded at pointer down; live updates used recordHistory=false.
      // No additional history entry needed here.
    }

    pointerDragRef.current.dragType = null;
    pointerDragRef.current.tempPath = undefined;
    pointerDragRef.current.initialShape = undefined;
    drawCanvas();
  }, [
    activeColor,
    activeFillColor,
    activeStrokeSize,
    activeShapeType,
    activeTool,
    activeBlurMode,
    activeBlurSize,
    drawCanvas,
    updateCurrentState,
  ]);

  // ── Synchronous Export on Send ──
  const exportAllEditedImages = useCallback(async (): Promise<MediaFileItem[]> => {
    const result: MediaFileItem[] = [];

    for (let i = 0; i < mediaFiles.length; i++) {
      const item = mediaFiles[i];
      const state = editStates[i];

      if (item.type !== "image" || !hasImageEdits(state)) {
        result.push(item);
        continue;
      }

      try {
        const exported = await renderEditedImage(item, state);
        result.push(exported);
      } catch (err) {
        console.error(`Failed to export edited image ${i}:`, err);
        result.push(item);
      }
    }

    return result;
  }, [mediaFiles, editStates]);

  const handleSend = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const exportedMediaFiles = await exportAllEditedImages();
      const text = textRef.current.trim();
      onSend(text, exportedMediaFiles);
      textRef.current = "";
      setCaption("");
      if (editorRef.current) {
        editorRef.current.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
      }
    } catch (err) {
      console.error("Error during media preview export on send:", err);
      onSend(textRef.current.trim());
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, exportAllEditedImages, onSend]);

  // Apply crop to the current media file and update the preview
  const handleApplyCrop = useCallback(async () => {
    if (!currentMedia || currentMedia.type !== "image" || !onUpdateMedia) return;
    try {
      const exported = await renderEditedImage(currentMedia, currentState);
      onUpdateMedia(currentIndex, exported.file, exported.preview);
      resetCurrent();
      setActiveTool("none");
      setSelectedElementId(null);
    } catch (err) {
      console.error("Failed to apply crop:", err);
    }
  }, [currentMedia, currentState, currentIndex, onUpdateMedia, resetCurrent]);

  // Keep refs in sync for keyboard shortcut handler
  handleSendRef.current = handleSend;
  handleApplyCropRef.current = handleApplyCrop;

  // Download Current Image
  const handleDownloadCurrent = useCallback(async () => {
    if (!currentMedia || currentMedia.type !== "image") return;
    try {
      const exported = await renderEditedImage(currentMedia, currentState);
      const a = document.createElement("a");
      a.href = exported.preview;
      a.download = `edited_${currentMedia.name || "image.png"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  }, [currentMedia, currentState]);

  // Copy Current Edited Image to Clipboard
  const handleCopyCurrent = useCallback(async () => {
    if (!currentMedia || currentMedia.type !== "image") return;
    try {
      const exported = await renderEditedImage(currentMedia, currentState);
      if (!exported.file) return;
      // ClipboardItem widely supports only image/png — re-encode to PNG
      // regardless of the original format so the copy actually succeeds.
      let pngBlob: Blob | null = exported.file;
      if (exported.file.type !== "image/png") {
        const img = new Image();
        img.src = exported.preview;
        await new Promise<void>((resolve, reject) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image for PNG re-encode"));
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || exported.width || 800;
        canvas.height = img.naturalHeight || exported.height || 600;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      }
      if (!pngBlob) throw new Error("PNG re-encode produced null blob");

      if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
        const item = new ClipboardItem({ "image/png": pngBlob });
        await navigator.clipboard.write([item]);
      } else {
        // Legacy fallback — copy via a hidden <img> + execCommand.
        const img = document.createElement("img");
        img.src = exported.preview;
        img.style.position = "fixed";
        img.style.opacity = "0";
        document.body.appendChild(img);
        const range = document.createRange();
        range.selectNode(img);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand("copy");
        sel?.removeAllRanges();
        document.body.removeChild(img);
      }
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 1800);
    } catch (err) {
      console.error("Failed to copy image:", err);
      setCopiedFeedback(false);
    }
  }, [currentMedia, currentState]);

  // Keep ref in sync for keyboard shortcut handler
  handleCopyRef.current = handleCopyCurrent;

  // Remove Item / Delete Selection
  const handleDeleteOrRemove = useCallback(() => {
    if (selectedElementId) {
      updateCurrentState((prev) => ({
        ...prev,
        texts: prev.texts.filter((t) => t.id !== selectedElementId),
        shapes: prev.shapes.filter((s) => s.id !== selectedElementId),
        emojis: prev.emojis.filter((m) => m.id !== selectedElementId),
      }));
      setSelectedElementId(null);
    } else {
      if (mediaFiles.length === 0) return;
      if (mediaFiles[currentIndex]?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaFiles[currentIndex].preview);
      }
      onRemoveMedia(currentIndex);
      if (mediaFiles.length === 1) {
        onClose();
      } else {
        setCurrentIndex((i) => Math.min(i, mediaFiles.length - 2));
      }
    }
  }, [selectedElementId, updateCurrentState, mediaFiles, currentIndex, onRemoveMedia, onClose]);

  const handleRemoveThumb = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      if (mediaFiles[index]?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaFiles[index].preview);
      }
      onRemoveMedia(index);
      if (mediaFiles.length === 1) {
        onClose();
      } else if (index < currentIndex) {
        setCurrentIndex((i) => i - 1);
      } else if (index === currentIndex && index === mediaFiles.length - 1) {
        setCurrentIndex((i) => i - 1);
      }
    },
    [currentIndex, mediaFiles, onRemoveMedia, onClose]
  );

  const handleAddMore = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0 && onAddMore) {
        onAddMore(files);
      }
      e.target.value = "";
    },
    [onAddMore]
  );

  // ── Drag & Drop file support (same pattern as MessageList) ──
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const isExternalFileDrag = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (!types?.includes("Files")) return false;
    if (types.includes("text/uri-list") || types.includes("text/html")) return false;
    return true;
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExternalFileDrag(e)) return;
    dragCounterRef.current++;
    if (e.dataTransfer.items?.length > 0) setIsDragOver(true);
  }, [isExternalFileDrag]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExternalFileDrag(e)) return;
    if (--dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, [isExternalFileDrag]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExternalFileDrag(e)) return;
    setIsDragOver(false);
    dragCounterRef.current = 0;
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0 && onAddMore) {
      e.dataTransfer.clearData();
      requestAnimationFrame(() => onAddMore(files));
    }
  }, [onAddMore, isExternalFileDrag]);

  const addDefaultShape = useCallback((type: "rect" | "circle" | "line" | "arrow" = activeShapeType) => {
    const newShape: ShapeElement = {
      id: `shape_${Date.now()}`,
      type,
      start: { x: 0.35, y: 0.35 },
      end: { x: 0.65, y: 0.65 },
      color: activeColor,
      strokeWidth: activeStrokeSize,
      fillColor: activeFillColor,
    };
    updateCurrentState((prev) => ({
      ...prev,
      shapes: [...prev.shapes, newShape],
    }));
    setSelectedElementId(newShape.id);
  }, [activeShapeType, activeColor, activeStrokeSize, activeFillColor, updateCurrentState]);

  // ── Tool Toggles ──
  const toggleTool = useCallback((tool: ToolMode) => {
    const willActivate = activeTool !== tool;
    setActiveTool((prev) => {
      const next = prev === tool ? "none" : tool;
      if (next === "marker") {
        setActiveStrokeSize(26);
        setActiveColor((col) => (col === "#000000" || col === "#00a884" ? "#ffeb3b" : col));
      } else if (next === "pen") {
        setActiveStrokeSize(7);
      } else if (next === "text") {
        setTextInputPos({ x: 0.5, y: 0.45 });
        setTextInputValue("");
        setTextInputActive(true);
      } else {
        setTextInputActive(false);
        setTextInputValue("");
      }
      return next;
    });
    // Initialize default crop region when entering crop mode (outside setActiveTool callback)
    if (willActivate && tool === "crop") {
      updateCurrentState((p) => (p.crop ? p : { ...p, crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } }));
    }
    if (willActivate && tool === "blur") {
      setActiveBlurMode("box");
      // Always add a new blur region when activating the blur tool
      const newBlur = {
        type: "box" as const,
        style: activeBlurStyle,
        start: { x: 0.35, y: 0.38 },
        end: { x: 0.65, y: 0.62 },
        intensity: 50,
      };
      const newIdx = currentState.blurRegions.length;
      updateCurrentState((p) => ({
        ...p,
        blurRegions: [...p.blurRegions, newBlur],
      }));
      setSelectedBlurId(`blur_${newIdx}`);
    } else {
      setSelectedBlurId(null);
    }
    if (tool === "shapes") {
      // Always add a default centered shape when activating the shape tool.
      if (willActivate) {
        addDefaultShape();
      }
    } else {
      setSelectedElementId(null);
    }
    setHoveredFilter(null);
  }, [activeTool, addDefaultShape, updateCurrentState, activeBlurStyle, currentState.blurRegions]);

  const rotateCCW = useCallback(() => {
    updateCurrentState((prev) => ({
      ...prev,
      rotation: (prev.rotation - 90 + 360) % 360,
    }));
  }, [updateCurrentState]);

  const rotateCW = useCallback(() => {
    updateCurrentState((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
  }, [updateCurrentState]);

  const resetCropAndRotate = useCallback(() => {
    updateCurrentState((prev) => ({
      ...prev,
      crop: null,
      rotation: 0,
    }));
    setSelectedCropAspect("free");
  }, [updateCurrentState]);

  // Reset ALL edits on the current image — drawings, shapes, text, blur, emoji, crop, rotation, filter
  const resetAllEdits = useCallback(() => {
    setResetConfirmOpen(true);
  }, []);
  const confirmResetAll = useCallback(() => {
    // Reset state without recording history, then clear undo/redo stack
    updateCurrentState(() => createDefaultEditState(), false);
    resetCurrent();
    setSelectedElementId(null);
    setSelectedBlurId(null);
    setSelectedCropAspect("free");
    setActiveTool("none");
    setResetConfirmOpen(false);
  }, [updateCurrentState, resetCurrent]);

  // Add Emoji Sticker to Canvas
  const handleAddCanvasEmoji = useCallback(
    (emojiStr: string, imageUrl?: string) => {
      const newEmoji: EmojiElement = {
        id: `emoji_${Date.now()}`,
        emoji: emojiStr,
        x: 0.5,
        y: 0.5,
        size: 54,
        imageUrl,
      };
      updateCurrentState((prev) => ({
        ...prev,
        emojis: [...prev.emojis, newEmoji],
      }));
      setSelectedElementId(newEmoji.id);
      setCanvasEmojiAnchorEl(null);
    },
    [updateCurrentState]
  );

  // ── Caption Lexical Emoji Picker ──
  const onCaptionEmojiClick = useCallback((emojiData: { emoji: string }) => {
    const emoji = emojiData?.emoji || "";
    if (editorRef.current) {
      editorRef.current.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(emoji);
        } else {
          const root = $getRoot();
          let p = root.getLastChild();
          if (!p) {
            p = $createParagraphNode();
            root.append(p as ReturnType<typeof $createParagraphNode>);
          }
          (p as ReturnType<typeof $createParagraphNode>).append($createTextNode(emoji));
        }
      });
      editorRef.current.focus();
    }
  }, []);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setShowFormattingToolbar(false);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!range) return;
    const editorContainer = document.querySelector(".media-caption-editor .lexical-editor-container");
    if (!editorContainer || !editorContainer.contains(range.startContainer)) {
      setShowFormattingToolbar(false);
      return;
    }
    const rect = range.getBoundingClientRect();
    setToolbarPosition({
      top: rect.top - 50,
      left: rect.left + rect.width / 2,
    });
    setShowFormattingToolbar(true);
  }, []);

  if (!open || mediaFiles.length === 0) return null;

  const getMediaUrl = (item: MediaFileItem) =>
    item.preview || (item.file ? URL.createObjectURL(item.file) : "");

  const surfaceBg = isDark ? "#111b21" : "#ffffff";
  const headerBg = isDark ? "#111b21" : "#ffffff";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "#e9edef";
  const titleColor = theme.palette.text.primary;
  const subtitleColor = theme.palette.text.secondary;

  const currentFileMeta = {
    sizeText: formatSize(currentMedia?.size),
    extText: getExt(currentMedia?.name || "").toUpperCase(),
    iconUrl: getDocumentMeta(currentMedia?.name || "").iconUrl,
  };

  const isImage = currentMedia?.type === "image";
  const isVideo = currentMedia?.type === "video";
  const isFile = currentMedia?.type === "file";

  return (
    <div
      className="media-preview-overlay"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        background: isDark ? "#111b21" : "#ffffff",
      }}
    >
      {/* Drag & Drop overlay — same component as chat message area */}
      <DragDropOverlay isDragging={isDragOver} />
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: surfaceBg,
        }}
      >
        <MediaPreviewHeader
          currentMedia={currentMedia}
          isImage={isImage}
          currentIndex={currentIndex}
          total={mediaFiles.length}
          activeTool={activeTool}
          activeShapeType={activeShapeType}
          canUndo={canUndo}
          canRedo={canRedo}
          copied={copiedFeedback}
          selectedElementId={selectedElementId}
          canvasEmojiAnchorEl={canvasEmojiAnchorEl}
          sizeText={currentFileMeta.sizeText}
          extText={currentFileMeta.extText}
          titleColor={titleColor}
          subtitleColor={subtitleColor}
          borderColor={borderColor}
          headerBg={headerBg}
          isDark={isDark}
          onClose={requestClose}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToggleTool={toggleTool}
          onOpenShapes={(el) => {
            setShapesAnchorEl(el);
            setActiveTool("shapes");
          }}
          onOpenCanvasEmoji={(el) => setCanvasEmojiAnchorEl(el)}
          onDone={activeTool === "crop" ? () => { handleApplyCrop(); } : () => setActiveTool("none")}
          onCopy={handleCopyCurrent}
          onDownload={handleDownloadCurrent}
          onDeleteOrRemove={handleDeleteOrRemove}
          onResetAll={resetAllEdits}
          hasEdits={hasImageEdits(currentState)}
        />

        {isImage && activeTool === "filter" && (
          <MediaPreviewFilterBar
            currentMedia={currentMedia}
            selectedFilter={currentState.filter}
            hoveredFilter={hoveredFilter}
            titleColor={titleColor}
            borderColor={borderColor}
            isDark={isDark}
            getMediaUrl={getMediaUrl}
            onSelectFilter={(filter) => updateCurrentState((prev) => ({ ...prev, filter }))}
            onHoverFilter={setHoveredFilter}
          />
        )}

        <MediaPreviewPopovers
          shapesAnchorEl={shapesAnchorEl}
          canvasEmojiAnchorEl={canvasEmojiAnchorEl}
          showKeyboardHelp={showKeyboardHelp}
          activeShapeType={activeShapeType}
          titleColor={titleColor}
          subtitleColor={subtitleColor}
          borderColor={borderColor}
          headerBg={headerBg}
          isDark={isDark}
          onCloseShapes={() => setShapesAnchorEl(null)}
          onSelectShape={(shapeId) => {
            setActiveShapeType(shapeId);
            // If a shape is selected, change its type. Otherwise add a new shape.
            if (selectedElementId) {
              updateCurrentState((prev) => ({
                ...prev,
                shapes: prev.shapes.map((s) => (s.id === selectedElementId ? { ...s, type: shapeId } : s)),
              }));
            } else if (currentState.shapes.length === 0) {
              addDefaultShape(shapeId);
            }
          }}
          onCloseCanvasEmoji={() => setCanvasEmojiAnchorEl(null)}
          onAddCanvasEmoji={handleAddCanvasEmoji}
          onCloseKeyboardHelp={() => setShowKeyboardHelp(false)}
        />

        <MediaPreviewStage
          currentMedia={currentMedia}
          currentIndex={currentIndex}
          mediaFilesLength={mediaFiles.length}
          isImage={isImage}
          isVideo={isVideo}
          isFile={isFile}
          loadedVideos={loadedVideos}
          activeTool={activeTool}
          activeColor={activeColor}
          activeFontFamily={activeFontFamily}
          activeTextBgMode={activeTextBgMode}
          textInputActive={textInputActive}
          textInputValue={textInputValue}
          textInputPos={textInputPos}
          selectedElementId={selectedElementId}
          editingTextId={editingTextId}
          selectedBlurId={selectedBlurId}
          hoveredFilter={hoveredFilter}
          currentState={currentState}
          titleColor={titleColor}
          subtitleColor={subtitleColor}
          borderColor={borderColor}
          isDark={isDark}
          iconUrl={currentFileMeta.iconUrl}
          sizeText={currentFileMeta.sizeText}
          extText={currentFileMeta.extText}
          getMediaUrl={getMediaUrl}
          mediaStageRef={mediaStageRef}
          imgElementRef={imgElementRef}
          annotationCanvasRef={annotationCanvasRef}
          pointerDragRef={pointerDragRef}
          onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(mediaFiles.length - 1, i + 1))}
          onStagePointerDown={handleStagePointerDown}
          onStagePointerMove={handleStagePointerMove}
          onStagePointerUp={handleStagePointerUp}
          onImageLoad={drawCanvas}
          onVideoLoaded={(name) => setLoadedVideos((prev) => new Set(prev).add(name))}
          drawCanvas={drawCanvas}
          setSelectedElementId={setSelectedElementId}
          setEditingTextId={setEditingTextId}
          setSelectedBlurId={setSelectedBlurId}
          setTextInputValue={setTextInputValue}
          setTextInputActive={setTextInputActive}
          setTextInputPos={setTextInputPos}
          setCanvasEmojiAnchorEl={setCanvasEmojiAnchorEl}
          setActiveTool={setActiveTool}
          getNormalizedPoint={getNormalizedPoint}
          updateCurrentState={updateCurrentState}
        />

        {isImage && !(activeTool === "text" && textInputActive) && (
          <MediaPreviewToolControls
            activeTool={activeTool}
            activeColor={activeColor}
            activeFillColor={activeFillColor}
            activeStrokeSize={activeStrokeSize}
            activeFontFamily={activeFontFamily}
            activeTextBgMode={activeTextBgMode}
            activeBlurMode={activeBlurMode}
            activeBlurSize={activeBlurSize}
            activeBlurStyle={activeBlurStyle}
            selectedBlurId={selectedBlurId}
            selectedCropAspect={selectedCropAspect}
            selectedElementId={selectedElementId}
            titleColor={titleColor}
            subtitleColor={subtitleColor}
            borderColor={borderColor}
            isDark={isDark}
            onSetColor={setActiveColor}
            onSetFillColor={setActiveFillColor}
            onSetStrokeSize={setActiveStrokeSize}
            onSetFontFamily={setActiveFontFamily}
            onSetTextBgMode={setActiveTextBgMode}
            onSetBlurMode={setActiveBlurMode}
            onSetBlurStyle={(style) => {
              setActiveBlurStyle(style);
              updateCurrentState((prev) => ({
                ...prev,
                blurRegions: prev.blurRegions.map((b, i) => {
                  if (selectedBlurId) {
                    const selIdx = parseInt(selectedBlurId.replace("blur_", ""), 10);
                    return i === selIdx ? { ...b, style } : b;
                  }
                  return { ...b, style };
                }),
              }));
            }}
            onSetBlurSize={(val) => {
              setActiveBlurSize(val);
              // Update the selected blur region's intensity, or all regions if none selected
              updateCurrentState((prev) => ({
                ...prev,
                blurRegions: prev.blurRegions.map((b, i) => {
                  if (selectedBlurId) {
                    const selIdx = parseInt(selectedBlurId.replace("blur_", ""), 10);
                    return i === selIdx ? { ...b, intensity: val } : b;
                  }
                  // No selection → update all regions
                  return { ...b, intensity: val };
                }),
              }), false);
            }}
            onDeleteBlur={() => {
              if (!selectedBlurId) return;
              const idx = parseInt(selectedBlurId.replace("blur_", ""), 10);
              updateCurrentState((prev) => ({
                ...prev,
                blurRegions: prev.blurRegions.filter((_, i) => i !== idx),
              }));
              setSelectedBlurId(null);
            }}
            onSetCropAspect={(id, ratio) => {
              setSelectedCropAspect(id);
              if (ratio !== null) {
                updateCurrentState((prev) => ({
                  ...prev,
                  crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 / ratio },
                }));
              }
            }}
            onRotateCCW={rotateCCW}
            onRotateCW={rotateCW}
            onResetCropAndRotate={resetCropAndRotate}
            updateCurrentState={updateCurrentState}
          />
        )}

        <MediaPreviewThumbnails
          mediaFiles={mediaFiles}
          editStates={editStates}
          currentIndex={currentIndex}
          isDark={isDark}
          borderColor={borderColor}
          subtitleColor={subtitleColor}
          thumbsScrollRef={thumbsScrollRef}
          thumbItemRefs={thumbItemRefs}
          fileInputRef={fileInputRef}
          getMediaUrl={getMediaUrl}
          onSelectIndex={setCurrentIndex}
          onRemoveThumb={handleRemoveThumb}
          onAddMore={handleAddMore}
          onFileSelect={handleFileSelect}
        />

        <MediaPreviewCaptionBar
          caption={caption}
          isExporting={isExporting}
          showCaptionEmoji={showCaptionEmoji}
          showFormattingToolbar={showFormattingToolbar}
          toolbarPosition={toolbarPosition}
          isDark={isDark}
          borderColor={borderColor}
          titleColor={titleColor}
          subtitleColor={subtitleColor}
          syncKey={syncKey}
          editorRef={editorRef}
          captionEmojiBtnRef={captionEmojiBtnRef}
          editorWrapperRef={editorWrapperRef}
          onEditorChange={handleEditorChange}
          onKeyDown={handleSend}
          onSend={handleSend}
          onToggleCaptionEmoji={() => setShowCaptionEmoji((v) => !v)}
          onCaptionEmojiClick={onCaptionEmojiClick}
          onCloseCaptionEmoji={() => setShowCaptionEmoji(false)}
          onSelectionChange={handleSelectionChange}
        />
      </div>

      {/* Reset all edits confirmation */}
      <ConfirmationDialog
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={confirmResetAll}
        title="Reset edits?"
        description="All changes to this image will be removed."
        confirmText="Reset"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Close with unsaved edits confirmation */}
      <ConfirmationDialog
        isOpen={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        onConfirm={confirmClose}
        title="Discard selection?"
        description="Your selected media will be removed."
        confirmText="Discard"
        cancelText="Keep"
        variant="danger"
      />
    </div>
  );
};

export default memo(MediaPreviewComponent);
