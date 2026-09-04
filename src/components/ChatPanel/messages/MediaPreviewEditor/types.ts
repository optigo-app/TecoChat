import type { MediaFileItem } from "../../CoreLogic/uiReducer";
export type { MediaFileItem };

export interface DrawingPath {
  points: Array<{ x: number; y: number }>;
  color: string;
  size: number;
  isMarker?: boolean;
}

export interface ShapeElement {
  id: string;
  type: "rect" | "circle" | "line" | "arrow";
  start: { x: number; y: number };
  end: { x: number; y: number };
  color: string;
  strokeWidth: number;
  fillColor: string | null;
}

export type TextBgMode = "none" | "subtle" | "solid";

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontFamily: "system" | "serif" | "monospace" | "cursive" | "impact";
  bgMode: TextBgMode;
  fontSize: number;
}

export interface BlurRegion {
  type: "box" | "path";
  style?: "pixelate" | "smooth";
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  points?: Array<{ x: number; y: number }>;
  size?: number;
  intensity?: number; // 0–100, controls pixelate block size or blur radius
}

export interface EmojiElement {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  imageUrl?: string;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FilterType =
  | "none" | "pop" | "bw" | "cool" | "warm" | "chrome" | "film"
  | "sepia" | "fade" | "vintage";

export interface ImageEditState {
  drawings: DrawingPath[];
  shapes: ShapeElement[];
  texts: TextElement[];
  blurRegions: BlurRegion[];
  emojis: EmojiElement[];
  crop: CropRect | null;
  rotation: number;
  filter: FilterType;
}

export interface MediaPreviewProps {
  open: boolean;
  mediaFiles: MediaFileItem[];
  onClose: () => void;
  onSend: (caption: string, exportedFiles?: MediaFileItem[]) => void;
  onRemoveMedia: (index: number) => void;
  onAddMore?: (files: File[]) => void;
  onUpdateMedia?: (index: number, file: File, preview: string) => void;
  syncKey?: string | number;
}

export type ToolMode =
  | "none" | "crop" | "filter" | "pen" | "marker" | "text"
  | "shapes" | "blur" | "emoji" | "sticker";
