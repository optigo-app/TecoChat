"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Box, Skeleton, Typography, IconButton, useTheme, alpha } from "@mui/material";
import { FileText, Download, Eye } from "lucide-react";
import { handleDownloadFile } from "../../../../utils/globalFunc";
import { loadPdf, renderPageToCanvas } from "../../../../utils/pdfUtils";

interface PdfThumbnailProps {
  src: string;
  fileName: string;
  fileSize?: number;
  onClick?: () => void;
}

const THUMB_WIDTH = 250;
// Fixed preview height — canvas fills the area with object-fit: cover
// (crops overflow). Keeps every PDF card the same height regardless of
// page aspect ratio, like WhatsApp's document preview thumbnails.
const THUMB_PREVIEW_HEIGHT = 180;

const formatSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const PdfThumbnailComponent = ({ src, fileName, fileSize, onClick }: PdfThumbnailProps) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  // Use a render lock to prevent concurrent renders on the same canvas
  // (React Strict Mode double-invokes effects in dev)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const pdfRef = useRef<{ destroy: () => void } | null>(null);
  const cancelledRef = useRef(false);
  const renderIdRef = useRef(0); // increments on each render attempt

  const renderThumbnail = useCallback(async () => {
    if (!src || !canvasRef.current) return;
    const myRenderId = ++renderIdRef.current;

    // Cancel any previous render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    if (pdfRef.current) {
      pdfRef.current.destroy();
      pdfRef.current = null;
    }

    cancelledRef.current = false;
    setLoading(true);
    setError(false);

    try {
      const pdf = await loadPdf(src);
      if (cancelledRef.current || myRenderId !== renderIdRef.current) {
        pdf.destroy();
        return;
      }
      pdfRef.current = pdf;
      setPageCount(pdf.numPages);
      const page = await pdf.getPage(1);
      if (cancelledRef.current || myRenderId !== renderIdRef.current) {
        page.cleanup();
        pdf.destroy();
        return;
      }

      // Render to an OFFSCREEN canvas first, then copy to the visible canvas.
      // This completely avoids "Cannot use the same canvas during multiple
      // render() operations" because PDF.js never touches the visible canvas
      // directly — each render gets its own fresh offscreen canvas.
      const offscreen = document.createElement("canvas");
      const task = renderPageToCanvas(page, offscreen, THUMB_WIDTH);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;

      // A newer render superseded us — don't copy to visible canvas
      if (cancelledRef.current || myRenderId !== renderIdRef.current) {
        page.cleanup();
        pdf.destroy();
        return;
      }

      // Copy the offscreen render to the visible canvas
      const visible = canvasRef.current;
      if (visible) {
        const ctx = visible.getContext("2d");
        if (ctx) {
          visible.width = offscreen.width;
          visible.height = offscreen.height;
          ctx.drawImage(offscreen, 0, 0);
        }
      }

      // Clean up the PDF document after rendering
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    } catch (err: any) {
      if (err?.name === "RenderingCancelledException" || cancelledRef.current || myRenderId !== renderIdRef.current) {
        return; // Silent — just a cancelled/superseded render
      }
      console.error("PdfThumbnail render error:", err);
      setError(true);
    } finally {
      if (!cancelledRef.current && myRenderId === renderIdRef.current) {
        setLoading(false);
      }
    }
  }, [src]);

  useEffect(() => {
    renderThumbnail();
    return () => {
      // Cleanup on unmount or re-render: cancel ongoing render + destroy PDF
      cancelledRef.current = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [renderThumbnail]);

  return (
    <Box
      sx={{
        width: THUMB_WIDTH,
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: alpha(theme.palette.text.primary, 0.05),
        cursor: "pointer",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* ── Thumbnail / first-page preview (fixed height) ──────────────── */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: THUMB_PREVIEW_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: alpha(theme.palette.text.primary, 0.03),
          overflow: "hidden",
        }}
      >
        {loading && (
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        )}

        {error ? (
          // Fallback: show a large PDF icon if rendering fails
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              color: alpha(theme.palette.text.primary, 0.4),
              height: "100%",
              justifyContent: "center",
            }}
          >
            <FileText size={48} />
            <Typography variant="caption" sx={{ fontSize: 11 }}>
              Preview unavailable
            </Typography>
          </Box>
        ) : (
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top center",
              display: loading ? "none" : "block",
            }}
          />
        )}

        {/* Hover overlay with eye icon (WhatsApp-style "tap to open") */}
        {!loading && !error && (
          <Box
            className="pdf-thumb-overlay"
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: alpha("#000", 0),
              transition: "background-color 0.2s",
              "&:hover": {
                backgroundColor: alpha("#000", 0.25),
              },
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: alpha("#000", 0.5),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                opacity: 0,
                transition: "opacity 0.2s",
                ".pdf-thumb-overlay:hover &": { opacity: 1 },
              }}
            >
              <Eye size={20} />
            </Box>
          </Box>
        )}

        {/* Page count badge (top-right) */}
        {!loading && !error && pageCount != null && (
          <Box
            sx={{
              position: "absolute",
              top: 6,
              right: 6,
              px: 1,
              py: 0.25,
              borderRadius: "6px",
              backgroundColor: alpha("#000", 0.6),
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </Box>
        )}
      </Box>

      {/* ── File info bar (WhatsApp-style) ─────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          padding: "8px 12px",
          backgroundColor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.background.default, 0.3)
              : alpha(theme.palette.background.default, 0.5),
        }}
      >
        {/* PDF icon */}
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#f24e1e",
            backgroundColor: alpha("#f24e1e", 0.1),
          }}
        >
          <FileText size={18} />
        </Box>

        {/* Filename + size */}
        <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              fontSize: 13,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={fileName}
          >
            {fileName}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: 11,
              color: alpha(theme.palette.text.primary, 0.6),
              display: "flex",
              gap: 0.5,
            }}
          >
            <span>PDF</span>
            {fileSize != null && <span>· {formatSize(fileSize)}</span>}
          </Typography>
        </Box>

        {/* Download button */}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            if (src) handleDownloadFile(src, fileName);
          }}
          sx={{
            color: "text.secondary",
            flexShrink: 0,
            "&:hover": { bgcolor: "action.hover", color: "text.primary" },
          }}
          title="Download"
        >
          <Download size={18} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default memo(PdfThumbnailComponent);
