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
const THUMB_WIDTH_CSS = "min(250px, 78vw)";
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
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const pdfRef = useRef<{ destroy: () => void } | null>(null);
  const cancelledRef = useRef(false);
  const renderIdRef = useRef(0); // increments on each render attempt

  const isRemoteUrl = src && !src.startsWith("blob:") && !src.startsWith("data:");
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const skipRender = isOffline && isRemoteUrl;

  const renderThumbnail = useCallback(async () => {
    if (!src || !canvasRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false &&
        !src.startsWith("blob:") && !src.startsWith("data:")) {
      setError(true);
      setLoading(false);
      return;
    }
    const myRenderId = ++renderIdRef.current;

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

      const offscreen = document.createElement("canvas");
      const task = renderPageToCanvas(page, offscreen, THUMB_WIDTH);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;

      if (cancelledRef.current || myRenderId !== renderIdRef.current) {
        page.cleanup();
        pdf.destroy();
        return;
      }

      const visible = canvasRef.current;
      if (visible) {
        const ctx = visible.getContext("2d");
        if (ctx) {
          visible.width = offscreen.width;
          visible.height = offscreen.height;
          ctx.drawImage(offscreen, 0, 0);
        }
      }

      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    } catch (err: any) {
      if (err?.name === "RenderingCancelledException" || cancelledRef.current || myRenderId !== renderIdRef.current) {
        return;
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

  useEffect(() => {
    const handleOnline = () => {
      if (isRemoteUrl) {
        setError(false);
        setLoading(true);
        renderThumbnail();
      }
    };
    const handleOffline = () => {
      if (isRemoteUrl) {
        setError(true);
        setLoading(false);
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isRemoteUrl, renderThumbnail]);

  return (
    <Box
      sx={{
        width: THUMB_WIDTH_CSS,
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
        {(loading && !skipRender) && (
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        )}

        {(error || skipRender) ? (
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

        {!loading && !error && !skipRender && (
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

        {!loading && !error && !skipRender && pageCount != null && (
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
