import { Square, Circle, Minus, MoveUpRight } from "lucide-react";
import type { FilterType, ImageEditState } from "./types";

export const WA_COLORS = ["#00a884", "#25d366", "#34b7f1", "#007aff", "#9c27b0", "#e91e63", "#ff3b30", "#ff9500", "#ffcc00", "#ffffff", "#000000"];
export const PEN_STROKE_SIZES = [
  { label: "Fine", value: 3, dotSize: 6 }, { label: "Medium", value: 7, dotSize: 10 },
  { label: "Bold", value: 14, dotSize: 14 }, { label: "Heavy", value: 24, dotSize: 18 },
];
export const MARKER_STROKE_SIZES = [
  { label: "Fine", value: 16, dotSize: 10 }, { label: "Medium", value: 26, dotSize: 14 },
  { label: "Bold", value: 38, dotSize: 18 }, { label: "Heavy", value: 52, dotSize: 22 },
];
export const STROKE_SIZES = PEN_STROKE_SIZES;
export const FONT_FAMILIES = [
  { id: "system" as const, label: "Sans", font: "sans-serif" }, { id: "serif" as const, label: "Serif", font: "Georgia, serif" },
  { id: "monospace" as const, label: "Mono", font: "Courier New, monospace" }, { id: "cursive" as const, label: "Script", font: "Pacifico, cursive" },
  { id: "impact" as const, label: "Impact", font: "Impact, sans-serif" },
];
export const FILTERS: Array<{ id: FilterType; label: string; css: string }> = [
  { id: "none", label: "None", css: "none" }, { id: "pop", label: "Pop", css: "contrast(1.25) saturate(1.4) brightness(1.05)" },
  { id: "bw", label: "B&W", css: "grayscale(100%) contrast(1.15)" }, { id: "cool", label: "Cool", css: "hue-rotate(18deg) saturate(1.2) brightness(1.05)" },
  { id: "warm", label: "Warm", css: "sepia(30%) saturate(1.4) brightness(1.05) hue-rotate(-12deg)" }, { id: "chrome", label: "Chrome", css: "contrast(1.35) saturate(1.35) brightness(0.95)" },
  { id: "film", label: "Film", css: "sepia(25%) contrast(1.15) brightness(1.02) saturate(1.1)" }, { id: "sepia", label: "Sepia", css: "sepia(100%) contrast(1.05)" },
  { id: "fade", label: "Fade", css: "contrast(0.88) brightness(1.12) saturate(0.92)" }, { id: "vintage", label: "Vintage", css: "sepia(45%) contrast(1.2) brightness(0.92) saturate(1.25)" },
];
export const SHAPE_OPTIONS = [
  { id: "rect" as const, label: "Rectangle", icon: Square }, { id: "circle" as const, label: "Circle", icon: Circle },
  { id: "line" as const, label: "Line", icon: Minus }, { id: "arrow" as const, label: "Arrow", icon: MoveUpRight },
];
export const ASPECT_RATIOS = [{ id: "free", label: "Free", ratio: null }, { id: "1:1", label: "1:1", ratio: 1 }, { id: "4:3", label: "4:3", ratio: 4 / 3 }, { id: "16:9", label: "16:9", ratio: 16 / 9 }];
export const KEYBOARD_SHORTCUTS = [
  { key: "P", desc: "Pen / Drawing Tool" }, { key: "M", desc: "Highlighter / Marker" }, { key: "T", desc: "Text Tool" }, { key: "S", desc: "Shapes (Rect, Circle, Line, Arrow)" }, { key: "B", desc: "Mosaic / Pixelate Tool" }, { key: "C", desc: "Crop & Rotate" }, { key: "F", desc: "Filters Bar" }, { key: "E", desc: "Emoji Sticker" }, { key: "H", desc: "Toggle HD Quality" }, { key: "Ctrl + C", desc: "Copy Image to Clipboard" }, { key: "R", desc: "Rotate 90° CW (in crop mode)" }, { key: "Ctrl + Z", desc: "Undo Edit" }, { key: "Ctrl + Y", desc: "Redo Edit" }, { key: "Delete", desc: "Delete Selected Element" }, { key: "Esc", desc: "Cancel Tool / Close Preview" }, { key: "← / →", desc: "Previous / Next Image" }, { key: "Enter", desc: "Send Message" },
];
export const createDefaultEditState = (): ImageEditState => ({ drawings: [], shapes: [], texts: [], blurRegions: [], emojis: [], crop: null, rotation: 0, filter: "none", isHd: false });
export const formatSize = (bytes?: number) => { if (!bytes) return ""; const kb = bytes / 1024; return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`; };
export const getExt = (name: string) => { const parts = (name || "").toLowerCase().split("."); return parts.length < 2 ? "" : parts.pop() || ""; };
export const getFilterCssString = (filter: FilterType) => FILTERS.find((item) => item.id === filter)?.css || "none";
