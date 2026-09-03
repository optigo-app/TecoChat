import type { MediaFileItem } from "../../CoreLogic/uiReducer";
import type { TextElement, EmojiElement, ImageEditState } from "./types";
import { getFilterCssString } from "./constants";

/** Draw an arrow with an optional fill color for the head. */
export function drawArrowOnCanvas(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string, width: number, fillColor?: string) {
  const headLength = Math.max(14, width * 3.2);
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();

  ctx.beginPath(); ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  ctx.stroke();
}

/** Pixelate a rectangular region of a canvas by downscaling then upscaling.
 *  blockSize controls the mosaic tile size — higher = more pixelated.
 *  If sourceImage is provided, reads pixels from the image instead of the canvas. */
export function applyPixelateBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  blockSize: number = 14,
  sourceImage?: CanvasImageSource
) {
  if (w <= 0 || h <= 0) return;
  const sampleW = Math.max(1, Math.floor(w / blockSize));
  const sampleH = Math.max(1, Math.floor(h / blockSize));

  const offscreen = document.createElement("canvas");
  offscreen.width = sampleW;
  offscreen.height = sampleH;
  const offCtx = offscreen.getContext("2d");
  if (!offCtx) return;

  if (sourceImage) {
    // Read from the source image — map canvas coords to image natural coords
    const dpr = window.devicePixelRatio || 1;
    const canvasW = ctx.canvas.width / dpr;
    const canvasH = ctx.canvas.height / dpr;
    const img = sourceImage as HTMLImageElement;
    const sx = (x / canvasW) * img.naturalWidth;
    const sy = (y / canvasH) * img.naturalHeight;
    const sw = (w / canvasW) * img.naturalWidth;
    const sh = (h / canvasH) * img.naturalHeight;
    offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sampleW, sampleH);
  } else {
    offCtx.drawImage(ctx.canvas, x, y, w, h, 0, 0, sampleW, sampleH);
  }

  const oldSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, 0, 0, sampleW, sampleH, x, y, w, h);
  ctx.imageSmoothingEnabled = oldSmoothing;
}

/** Map an intensity value (0–100) to a pixelate block size. */
export function intensityToBlockSize(intensity: number, imageWidth: number): number {
  // intensity 0 → barely visible (block ~3px), 100 → very coarse (block ~60px)
  const scaled = Math.max(3, Math.round((intensity / 100) * 60 * (imageWidth / 800)));
  return Math.max(3, scaled);
}

/** Apply a Gaussian-style blur to a rectangular or circular region using the source image. */
export function applyInteractiveBlur(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  path = false
) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  if (path) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.max(w, h) / 2, 0, Math.PI * 2);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  ctx.filter = `blur(${Math.max(4, radius)}px)`;
  const dpr = window.devicePixelRatio || 1;
  const width = ctx.canvas.width / dpr;
  const height = ctx.canvas.height / dpr;
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, width, height);
  ctx.restore();
}

/** Apply blur along a freehand path by clipping to circles at each point. */
export function applyInteractiveBlurPath(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  size: number,
  radius: number
) {
  if (!points.length) return;
  ctx.save();
  ctx.beginPath();
  for (const point of points) {
    ctx.moveTo(point.x * width + size / 2, point.y * height);
    ctx.arc(point.x * width, point.y * height, size / 2, 0, Math.PI * 2);
  }
  ctx.clip();
  ctx.filter = `blur(${Math.max(4, radius)}px)`;
  const dpr = window.devicePixelRatio || 1;
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr);
  ctx.restore();
}

/** Pixelate along a freehand path by stamping pixelated squares at each point. */
export function applyPixelatePath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  size: number,
  blockSize: number,
  sourceImage?: CanvasImageSource
) {
  if (!points.length) return;
  for (const p of points) {
    const px = p.x * width - size / 2;
    const py = p.y * height - size / 2;
    applyPixelateBox(ctx, px, py, size, size, blockSize, sourceImage);
  }
}

const FONT_FAMILY_MAP: Record<string, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  monospace: "'Courier New', Courier, monospace",
  cursive: "'Pacifico', 'Brush Script MT', cursive",
  impact: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
};

/** Render a text element onto an export canvas. */
export function renderTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: TextElement,
  imageW: number,
  imageH: number
) {
  if (!text.text) return;
  const x = text.x * imageW;
  const y = text.y * imageH;
  const fontSize = Math.max(16, Math.round(text.fontSize * (imageW / 800)));
  const fontName = FONT_FAMILY_MAP[text.fontFamily] || FONT_FAMILY_MAP.system;
  ctx.font = `600 ${fontSize}px ${fontName}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = text.text.split("\n");
  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;

  let maxWidth = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    if (m.width > maxWidth) maxWidth = m.width;
  }

  const padX = fontSize * 0.5;
  const padY = fontSize * 0.3;
  const boxW = maxWidth + padX * 2;
  const boxH = totalHeight + padY * 2;
  const boxX = x - boxW / 2;
  const boxY = y - boxH / 2;

  if (text.bgMode === "solid" || text.bgMode === "subtle") {
    ctx.fillStyle = text.color === "#ffffff" ? "#111827" : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, fontSize * 0.25);
    ctx.fill();
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
  }

  ctx.fillStyle = text.color;
  lines.forEach((line, idx) => {
    const lineY = y - totalHeight / 2 + lineHeight * (idx + 0.5) + padY * 0.15;
    ctx.fillText(line, x, lineY);
  });

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

/** Render an emoji sticker onto an export canvas. */
export function renderEmojiOnCanvas(
  ctx: CanvasRenderingContext2D,
  emoji: EmojiElement,
  imageW: number,
  imageH: number
) {
  const x = emoji.x * imageW;
  const y = emoji.y * imageH;
  const size = Math.max(26, Math.round(emoji.size * (imageW / 800)));
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji.emoji, x, y);
}

/**
 * Render the full edited image (rotation, crop, filter, blur, drawings,
 * shapes, text, emoji) to a new MediaFileItem with an exported File/preview.
 */
export async function renderEditedImage(
  item: MediaFileItem,
  state: ImageEditState
): Promise<MediaFileItem> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  const sourceUrl = item.preview || (item.file ? URL.createObjectURL(item.file) : "");
  const shouldRevoke = !item.preview && !!sourceUrl;
  image.src = sourceUrl;

  await new Promise<void>((resolve, reject) => {
    if (image.complete) return resolve();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image for export"));
  });

  const origW = image.naturalWidth || 800;
  const origH = image.naturalHeight || 600;

  // 1. Rotation step
  const rot = ((state.rotation % 360) + 360) % 360;
  const isRotated90or270 = rot === 90 || rot === 270;
  const rotW = isRotated90or270 ? origH : origW;
  const rotH = isRotated90or270 ? origW : origH;

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = rotW;
  rotCanvas.height = rotH;
  const rotCtx = rotCanvas.getContext("2d")!;

  if (state.filter && state.filter !== "none") {
    rotCtx.filter = getFilterCssString(state.filter);
  }

  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate((rot * Math.PI) / 180);
  rotCtx.drawImage(image, -origW / 2, -origH / 2);
  rotCtx.filter = "none";

  if (shouldRevoke) URL.revokeObjectURL(sourceUrl);

  // 2. Crop step
  const crop = state.crop;
  if (crop) {
    const cropX = Math.round(crop.x * rotW);
    const cropY = Math.round(crop.y * rotH);
    const cropW = Math.max(1, Math.round(crop.width * rotW));
    const cropH = Math.max(1, Math.round(crop.height * rotH));

    const maxDim = state.isHd ? 2560 : 1600;
    let outW = cropW;
    let outH = cropH;
    if (outW > maxDim || outH > maxDim) {
      if (outW > outH) {
        outH = Math.round((outH * maxDim) / outW);
        outW = maxDim;
      } else {
        outW = Math.round((outW * maxDim) / outH);
        outH = maxDim;
      }
    }

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = outW;
    finalCanvas.height = outH;
    const finalCtx = finalCanvas.getContext("2d")!;
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = "high";

    finalCtx.drawImage(rotCanvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
    drawAnnotations(finalCtx, state, outW, outH);
    return await canvasToMediaFile(finalCanvas, item, outW, outH, state.isHd);
  }

  // No crop — use full rotated image
  const maxDim = state.isHd ? 2560 : 1600;
  let outW = rotW;
  let outH = rotH;
  if (outW > maxDim || outH > maxDim) {
    if (outW > outH) {
      outH = Math.round((outH * maxDim) / outW);
      outW = maxDim;
    } else {
      outW = Math.round((outW * maxDim) / outH);
      outH = maxDim;
    }
  }

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = outW;
  finalCanvas.height = outH;
  const finalCtx = finalCanvas.getContext("2d")!;
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = "high";

  finalCtx.drawImage(rotCanvas, 0, 0, rotW, rotH, 0, 0, outW, outH);

  drawAnnotations(finalCtx, state, outW, outH);
  return await canvasToMediaFile(finalCanvas, item, outW, outH, state.isHd);
}

/** Draw all annotations (blur, drawings, shapes, text, emoji) onto a canvas context. */
function drawAnnotations(ctx: CanvasRenderingContext2D, state: ImageEditState, outW: number, outH: number) {
  // Mosaic blur — uses per-region intensity for pixelate block size
  for (const blur of state.blurRegions) {
    const intensity = blur.intensity ?? 50; // default 50 if not set
    const blockSize = intensityToBlockSize(intensity, outW);
    if (blur.type === "box" && blur.start && blur.end) {
      const bx = Math.min(blur.start.x, blur.end.x) * outW;
      const by = Math.min(blur.start.y, blur.end.y) * outH;
      const bw = Math.abs(blur.end.x - blur.start.x) * outW;
      const bh = Math.abs(blur.end.y - blur.start.y) * outH;
      applyPixelateBox(ctx, bx, by, bw, bh, blockSize);
    } else if (blur.type === "path" && blur.points) {
      const bSize = (blur.size || 24) * (outW / 800);
      applyPixelatePath(ctx, blur.points, outW, outH, bSize, Math.max(4, Math.round(bSize / 2.5)));
    }
  }

  // Freehand drawing paths (Pen & Marker)
  for (const draw of state.drawings) {
    if (draw.points.length < 2) continue;
    ctx.save();
    if (draw.isMarker) {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.55;
      ctx.lineCap = "square";
      ctx.lineJoin = "bevel";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    ctx.strokeStyle = draw.color;
    ctx.lineWidth = Math.max(2, draw.size * (outW / 800));
    ctx.beginPath();
    draw.points.forEach((pt, idx) => {
      const px = pt.x * outW;
      const py = pt.y * outH;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  // Shapes
  for (const shape of state.shapes) {
    const sx = shape.start.x * outW;
    const sy = shape.start.y * outH;
    const ex = shape.end.x * outW;
    const ey = shape.end.y * outH;
    const sWidth = Math.max(2, shape.strokeWidth * (outW / 800));
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

  // Text elements
  for (const text of state.texts) {
    renderTextOnCanvas(ctx, text, outW, outH);
  }

  // Emoji stickers
  for (const emoji of state.emojis) {
    renderEmojiOnCanvas(ctx, emoji, outW, outH);
  }
}

/** Convert a canvas to a MediaFileItem with a new File and preview URL. */
async function canvasToMediaFile(canvas: HTMLCanvasElement, item: MediaFileItem, outW: number, outH: number, isHd?: boolean): Promise<MediaFileItem> {
  const isPng = item.file?.type === "image/png" || (item.name || "").toLowerCase().endsWith(".png");
  const mimeType = isPng ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, isHd ? 0.95 : 0.88);
  });

  if (!blob) throw new Error("Canvas export produced null blob");

  const baseName = (item.name || "image").replace(/\.[^/.]+$/, "");
  const fileName = `${baseName}${isPng ? ".png" : ".jpg"}`;
  const newFile = new File([blob], fileName, {
    type: mimeType,
    lastModified: Date.now(),
  });
  const newPreview = URL.createObjectURL(newFile);

  return {
    ...item,
    file: newFile,
    preview: newPreview,
    size: newFile.size,
    name: newFile.name,
    width: outW,
    height: outH,
  };
}

/** Check whether an edit state has any non-trivial edits. */
export function hasImageEdits(state: ImageEditState | undefined): state is ImageEditState {
  if (!state) return false;
  return (
    state.drawings.length > 0 ||
    state.shapes.length > 0 ||
    state.texts.length > 0 ||
    state.blurRegions.length > 0 ||
    state.emojis.length > 0 ||
    state.rotation !== 0 ||
    state.crop !== null ||
    state.filter !== "none" ||
    state.isHd
  );
}
