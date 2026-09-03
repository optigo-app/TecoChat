"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Box, Skeleton, Typography, useTheme, alpha } from "@mui/material";
import { FileText, ChevronUp, ChevronDown } from "lucide-react";
import { loadPdf, renderPageToCanvas, type PdfDocument } from "../../../../utils/pdfUtils";

export type PdfHighlight =
  | { type: "pen"; points: Array<{ x: number; y: number }> }
  | { type: "rect"; start: { x: number; y: number }; end: { x: number; y: number } };

interface PdfViewerProps {
  src: string;
  fileName?: string;
  /** Controlled zoom level (1 = 100%). When changed, pages re-render. */
  zoom?: number;
  /** Notify parent of page count once loaded. */
  onPdfLoaded?: (pageCount: number) => void;
  /** Notify parent of current page on scroll. */
  onPageChange?: (page: number) => void;
  /** Parent can trigger scroll-to-page by changing this value. */
  scrollToPageTrigger?: number;
  /** Expose the loaded PDF document to the parent for thumbnail rendering. */
  onPdfReady?: (pdf: PdfDocument) => void;
  annotationTool?: "none" | "pen" | "rect";
  annotations?: Record<number, PdfHighlight[]>;
  onAnnotationsChange?: (annotations: Record<number, PdfHighlight[]>) => void;
}

// Base render width at zoom=1.  Actual width = BASE * zoom.
const BASE_RENDER_WIDTH = 800;

const PdfViewerComponent = ({
  src,
  fileName,
  zoom = 1,
  onPdfLoaded,
  onPageChange,
  scrollToPageTrigger,
  onPdfReady,
  annotationTool = "none",
  annotations = {},
  onAnnotationsChange,
}: PdfViewerProps) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Track active render tasks so we can cancel them (Strict Mode safe)
  const activeRenderTasksRef = useRef<Set<{ cancel: () => void }>>(new Set());

  // ── Load PDF once ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const cancelAllRenders = () => {
      activeRenderTasksRef.current.forEach((t) => {
        try { t.cancel(); } catch { /* ignore */ }
      });
      activeRenderTasksRef.current.clear();
    };

    const loadAndRender = async () => {
      if (!src) return;
      setLoading(true);
      setError(false);
      setLoadedPages(new Set());

      try {
        const pdf = await loadPdf(src);
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        onPdfLoaded?.(pdf.numPages);
        onPdfReady?.(pdf);

        // Render all pages at current zoom
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          if (cancelled) {
            page.cleanup();
            return;
          }

          const canvas = pageRefs.current[i - 1]?.querySelector("canvas");
          if (canvas instanceof HTMLCanvasElement) {
            // Render to offscreen canvas first, then copy — avoids
            // "Cannot use the same canvas during multiple render() operations"
            const offscreen = document.createElement("canvas");
            const task = renderPageToCanvas(page, offscreen, BASE_RENDER_WIDTH * zoomRef.current);
            activeRenderTasksRef.current.add(task);
            try {
              await task.promise;
              if (!cancelled) {
                // Copy offscreen render to visible canvas
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  canvas.width = offscreen.width;
                  canvas.height = offscreen.height;
                  ctx.drawImage(offscreen, 0, 0);
                }
                setLoadedPages((prev) => new Set(prev).add(i));
              }
            } catch (err: any) {
              if (err?.name !== "RenderingCancelledException" && !cancelled) {
                throw err;
              }
            } finally {
              activeRenderTasksRef.current.delete(task);
            }
          }
          page.cleanup();
        }
      } catch (err) {
        console.error("PdfViewer load error:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAndRender();

    return () => {
      cancelled = true;
      cancelAllRenders();
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ── Re-render all pages when zoom changes ───────────────────────────────
  useEffect(() => {
    if (!pdfRef.current || loading || error) return;
    let cancelled = false;

    // Cancel any active renders from the previous zoom level
    activeRenderTasksRef.current.forEach((t) => {
      try { t.cancel(); } catch { /* ignore */ }
    });
    activeRenderTasksRef.current.clear();

    const reRender = async () => {
      const pdf = pdfRef.current;
      if (!pdf) return;
      setLoadedPages(new Set());

      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;
        const page = await pdf.getPage(i);
        if (cancelled) {
          page.cleanup();
          return;
        }
        const canvas = pageRefs.current[i - 1]?.querySelector("canvas");
        if (canvas instanceof HTMLCanvasElement) {
          // Render to offscreen canvas first, then copy
          const offscreen = document.createElement("canvas");
          const task = renderPageToCanvas(page, offscreen, BASE_RENDER_WIDTH * zoom);
          activeRenderTasksRef.current.add(task);
          try {
            await task.promise;
            if (!cancelled) {
              // Copy offscreen render to visible canvas
              const ctx = canvas.getContext("2d");
              if (ctx) {
                canvas.width = offscreen.width;
                canvas.height = offscreen.height;
                ctx.drawImage(offscreen, 0, 0);
              }
              setLoadedPages((prev) => new Set(prev).add(i));
            }
          } catch (err: any) {
            if (err?.name !== "RenderingCancelledException" && !cancelled) {
              throw err;
            }
          } finally {
            activeRenderTasksRef.current.delete(task);
          }
        }
        page.cleanup();
      }
    };

    reRender();

    return () => {
      cancelled = true;
      activeRenderTasksRef.current.forEach((t) => {
        try { t.cancel(); } catch { /* ignore */ }
      });
      activeRenderTasksRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // ── Track current page on scroll ─────────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      let bestPage = 1;
      let bestVisibility = 0;

      for (let i = 0; i < pageRefs.current.length; i++) {
        const el = pageRefs.current[i];
        if (!el) continue;
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        const visibleTop = Math.max(elTop, containerTop);
        const visibleBottom = Math.min(elBottom, containerTop + containerHeight);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        if (visibleHeight > bestVisibility) {
          bestVisibility = visibleHeight;
          bestPage = i + 1;
        }
      }
      setCurrentPage(bestPage);
      onPageChange?.(bestPage);
    }, 80);
  }, [onPageChange]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // ── Scroll to page when triggered by parent ─────────────────────────────
  useEffect(() => {
    if (scrollToPageTrigger && scrollToPageTrigger > 0) {
      const el = pageRefs.current[scrollToPageTrigger - 1];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToPageTrigger]);

  const drawingRef = useRef<{ page: number; annotation: PdfHighlight } | null>(null);

  const getNormalizedPoint = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  const handleAnnotationDown = useCallback((page: number, event: React.PointerEvent<SVGSVGElement>) => {
    if (annotationTool === "none" || !onAnnotationsChange) return;
    const point = getNormalizedPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const annotation: PdfHighlight = annotationTool === "pen"
      ? { type: "pen", points: [point] }
      : { type: "rect", start: point, end: point };
    drawingRef.current = { page, annotation };
    onAnnotationsChange({
      ...annotations,
      [page]: [...(annotations[page] || []), annotation],
    });
  }, [annotationTool, annotations, getNormalizedPoint, onAnnotationsChange]);

  const handleAnnotationMove = useCallback((page: number, event: React.PointerEvent<SVGSVGElement>) => {
    const drawing = drawingRef.current;
    if (!drawing || drawing.page !== page || !onAnnotationsChange) return;
    const point = getNormalizedPoint(event);
    if (!point) return;
    const next = drawing.annotation.type === "pen"
      ? { ...drawing.annotation, points: [...drawing.annotation.points, point] }
      : { ...drawing.annotation, end: point };
    drawingRef.current = { page, annotation: next };
    const pageAnnotations = annotations[page] || [];
    onAnnotationsChange({ ...annotations, [page]: [...pageAnnotations.slice(0, -1), next] });
  }, [annotations, getNormalizedPoint, onAnnotationsChange]);

  const finishAnnotation = useCallback(() => {
    drawingRef.current = null;
  }, []);

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          width: "100%",
          gap: 2,
          color: alpha(theme.palette.text.primary, 0.5),
        }}
      >
        <FileText size={64} />
        <Typography variant="body1" sx={{ fontWeight: 500 }}>
          Failed to load PDF
        </Typography>
        {fileName && (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {fileName}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Scrollable page container ─────────────────────────────────────── */}
      <Box
        ref={containerRef}
        onScroll={handleScroll}
        className="pdf-viewer-scroll"
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden", // No horizontal scroll — pages fit width
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "16px 8px 80px 8px",
          // Hide scrollbar but keep vertical scrolling
          scrollbarWidth: "none", // Firefox
          msOverflowStyle: "none", // IE/Edge
          "&::-webkit-scrollbar": { display: "none" }, // WebKit
        }}
      >
        {loading && pageCount === 0 && (
          <Box sx={{ width: "100%", maxWidth: BASE_RENDER_WIDTH, mt: 4 }}>
            <Skeleton
              variant="rectangular"
              animation="wave"
              sx={{ width: "100%", height: 500, borderRadius: "8px" }}
            />
          </Box>
        )}

        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
          <Box
            key={pageNum}
            ref={(el: HTMLDivElement | null) => {
              pageRefs.current[pageNum - 1] = el;
            }}
            sx={{
              position: "relative",
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {/* Page number label */}
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                top: 4,
                right: 8,
                fontSize: 11,
                color: alpha(theme.palette.text.primary, 0.4),
                zIndex: 1,
                backgroundColor: alpha(theme.palette.background.paper, 0.6),
                px: 0.5,
                borderRadius: "4px",
              }}
            >
              {pageNum} / {pageCount}
            </Typography>

            {!loadedPages.has(pageNum) && (
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{
                  width: BASE_RENDER_WIDTH * zoom,
                  height: 500 * zoom,
                  borderRadius: "8px",
                }}
              />
            )}

            <canvas
              style={{
                maxWidth: "100%",
                height: "auto",
                display: loadedPages.has(pageNum) ? "block" : "none",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            />
            <svg
              aria-label={`Highlights for page ${pageNum}`}
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              onPointerDown={(event) => handleAnnotationDown(pageNum, event)}
              onPointerMove={(event) => handleAnnotationMove(pageNum, event)}
              onPointerUp={finishAnnotation}
              onPointerCancel={finishAnnotation}
              onPointerLeave={finishAnnotation}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: annotationTool === "none" ? "none" : "auto",
                touchAction: "none",
              }}
            >
              {(annotations[pageNum] || []).map((annotation, index) =>
                annotation.type === "pen" ? (
                  <polyline
                    key={index}
                    points={annotation.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke="rgba(255, 214, 0, 0.95)"
                    strokeWidth="0.018"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <rect
                    key={index}
                    x={Math.min(annotation.start.x, annotation.end.x)}
                    y={Math.min(annotation.start.y, annotation.end.y)}
                    width={Math.abs(annotation.end.x - annotation.start.x)}
                    height={Math.abs(annotation.end.y - annotation.start.y)}
                    fill="rgba(255, 214, 0, 0.3)"
                    stroke="rgba(255, 214, 0, 0.95)"
                    strokeWidth="0.004"
                  />
                )
              )}
            </svg>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(PdfViewerComponent);
