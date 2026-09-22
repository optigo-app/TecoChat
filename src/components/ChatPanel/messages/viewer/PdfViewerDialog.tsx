"use client";

import { useState, useCallback, useEffect, memo, useRef } from "react";
import { Dialog, IconButton, Tooltip, Box, useTheme, alpha } from "@mui/material";
import { PanelLeftClose, PanelLeft, Pencil, Square, Undo2, X, ChevronUp, ChevronDown } from "lucide-react";
import { handleDownloadFile } from "../../../../utils/globalFunc";
import { useIsTablet } from "../../../../hooks/useIsMobile";
import PdfViewer, { type PdfHighlight } from "./PdfViewer";
import MediaViewerHeader from "./MediaViewerHeader";
import { renderPageToCanvas, type PdfDocument } from "../../../../utils/pdfUtils";
import type { MediaViewerItem } from "../../CoreLogic/uiReducer";
import type { ChatMessage } from "../../../../types/message";
import type { ConversationListEntry } from "../../../../types/conversation";

// ─────────────────────────────────────────────────────────────────────────────
// PdfViewerDialog — standalone full-screen PDF viewer.
//
// Layout (like Adobe Acrobat / professional PDF viewers):
//   ┌─────────────────────────────────────────────────────┐
//   │ Header (reusable MediaViewerHeader)                   │
//   ├──────────┬──────────────────────────────────────────┤
//   │ Sidebar  │  PDF page scroll area                       │
//   │ (page    │                                              │
//   │ thumbs)  │                                              │
//   │          │                                              │
//   ├──────────┴──────────────────────────────────────────┤
//   │ Footer: page navigation (↑ current/total ↓)           │
//   └─────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

interface PdfViewerDialogProps {
  open: boolean;
  item: MediaViewerItem | null;
  message?: ChatMessage | null;
  messages?: ChatMessage[] | { data?: ChatMessage[] };
  selectedCustomer?: ConversationListEntry | null;
  onClose: () => void;
  onReply?: (msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage, event?: React.MouseEvent) => void;
  onQuickReaction?: (emoji: string, msg: ChatMessage) => void;
  onRemoveReaction?: (reaction: { Emoji?: string; Reaction?: string }, msg: ChatMessage) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const THUMB_WIDTH = 120;

const PdfViewerDialogComponent = ({
  open,
  item,
  message,
  messages,
  selectedCustomer,
  onClose,
  onReply,
  onForward,
  onQuickReaction,
  onRemoveReaction,
}: PdfViewerDialogProps) => {
  const theme = useTheme();
  const isTablet = useIsTablet();
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollToPageTrigger, setScrollToPageTrigger] = useState(0);
  // Sidebar: open by default on desktop, hidden on mobile+tablet (saves space).
  // On mobile+tablet it opens as a floating overlay instead of taking layout space.
  const [sidebarOpen, setSidebarOpen] = useState(!isTablet);
  const pdfDocRef = useRef<PdfDocument | null>(null);
  // Track which thumbnails have been rendered — use REF (not state) as the
  // primary guard so concurrent renderThumbnails calls see updates instantly
  // without waiting for a state re-render cycle.
  const renderedThumbsRef = useRef<Set<number>>(new Set());
  const [renderedThumbs, setRenderedThumbs] = useState<Set<number>>(new Set());
  // Serialize thumbnail rendering — only one renderThumbnails loop runs at a
  // time. Prevents two concurrent calls from both calling pdf.getPage(i) and
  // page.render() on the same page proxy (which throws "Cannot use the same
  // canvas during multiple render() operations").
  const isRenderingThumbsRef = useRef(false);
  const thumbCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [annotationTool, setAnnotationTool] = useState<"none" | "pen" | "rect">("none");
  const [annotations, setAnnotations] = useState<Record<number, PdfHighlight[]>>({});

  // Live message (sync with messages array for reaction updates)
  const liveMessage = (() => {
    const list = Array.isArray(messages)
      ? messages
      : Array.isArray((messages as { data?: ChatMessage[] })?.data)
        ? (messages as { data: ChatMessage[] }).data
        : [];
    return list.find(
      (m) => String(m.Id || m.MessageId) === String(message?.Id || message?.MessageId)
    ) || message;
  })();

  // Reset state when dialog opens with a new item
  useEffect(() => {
    if (open) {
      setZoom(1);
      setPageCount(0);
      setCurrentPage(1);
      setScrollToPageTrigger(0);
      renderedThumbsRef.current = new Set();
      setRenderedThumbs(new Set());
      isRenderingThumbsRef.current = false;
      setAnnotationTool("none");
      setAnnotations({});
      pdfDocRef.current = null;
    }
  }, [open, item?.src]);

  // ── Zoom controls ──────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  }, []);

  const handleZoomReset = useCallback(() => setZoom(1), []);

  // ── Page navigation ────────────────────────────────────────────────────
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      setScrollToPageTrigger(currentPage - 1);
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < pageCount) {
      setScrollToPageTrigger(currentPage + 1);
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, pageCount]);

  const goToPage = useCallback((page: number) => {
    setScrollToPageTrigger(page);
    setCurrentPage(page);
  }, []);

  // ── Render page thumbnails in the sidebar (serialized) ─────────────────
  // Only ONE renderThumbnails loop runs at a time (isRenderingThumbsRef).
  // Uses renderedThumbsRef (ref, not state) as the guard so concurrent calls
  // see updates instantly — prevents two calls from rendering the same page
  // on the same PDF.js page proxy concurrently.
  const renderThumbnails = useCallback(async () => {
    // If already rendering, skip — the active loop will pick up any new pages
    if (isRenderingThumbsRef.current) return;
    isRenderingThumbsRef.current = true;

    try {
      const pdf = pdfDocRef.current;
      if (!pdf) return;

      for (let i = 1; i <= pdf.numPages; i++) {
        // Check the REF (instant) not state (stale in concurrent calls)
        if (renderedThumbsRef.current.has(i)) continue;
        const canvas = thumbCanvasRefs.current[i - 1];
        if (!(canvas instanceof HTMLCanvasElement)) continue;

        try {
          const page = await pdf.getPage(i);
          // Render to a fresh offscreen canvas, then copy to visible canvas.
          // Each render gets its own canvas element so PDF.js never sees
          // concurrent renders on the same canvas.
          const offscreen = document.createElement("canvas");
          const task = renderPageToCanvas(page, offscreen, THUMB_WIDTH);
          await task.promise;
          // Copy to visible canvas
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = offscreen.width;
            canvas.height = offscreen.height;
            ctx.drawImage(offscreen, 0, 0);
          }
          page.cleanup();
          // Mark as rendered in BOTH ref (instant guard) and state (UI)
          renderedThumbsRef.current = new Set(renderedThumbsRef.current).add(i);
          setRenderedThumbs(new Set(renderedThumbsRef.current));
        } catch (err: any) {
          if (err?.name !== "RenderingCancelledException") {
            console.warn(`[PdfViewerDialog] Thumbnail render failed for page ${i}:`, err);
          }
        }
      }
    } finally {
      isRenderingThumbsRef.current = false;
    }
  }, []);

  // When PDF is ready, render thumbnails
  const handlePdfReady = useCallback((pdf: PdfDocument) => {
    pdfDocRef.current = pdf;
    // Reset BOTH ref and state so thumbnails render fresh
    renderedThumbsRef.current = new Set();
    setRenderedThumbs(new Set());
    // Delay slightly to let the sidebar canvases mount
    setTimeout(() => renderThumbnails(), 100);
  }, [renderThumbnails]);

  // Re-render thumbnails when sidebar is toggled open (canvases remount)
  useEffect(() => {
    if (sidebarOpen && pdfDocRef.current && pageCount > 0) {
      // Canvases just remounted — reset rendered state and re-render
      renderedThumbsRef.current = new Set();
      setRenderedThumbs(new Set());
      // Small delay for canvases to mount
      const timer = setTimeout(() => renderThumbnails(), 50);
      return () => clearTimeout(timer);
    }
  }, [sidebarOpen, pageCount, renderThumbnails]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        // Plain "+" / "=" — zoom in (legacy shortcut)
        handleZoomIn();
      } else if (e.key === "-") {
        // Plain "-" — zoom out (legacy shortcut)
        handleZoomOut();
      } else if (e.key === "0") {
        // Plain "0" — reset zoom (legacy shortcut)
        handleZoomReset();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        // Ctrl/Cmd + "+" — standard browser zoom-in
        e.preventDefault();
        handleZoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        // Ctrl/Cmd + "-" — standard browser zoom-out
        e.preventDefault();
        handleZoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        // Ctrl/Cmd + "0" — standard browser reset zoom
        e.preventDefault();
        handleZoomReset();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToNextPage();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, handleZoomIn, handleZoomOut, goToPrevPage, goToNextPage, handleZoomReset]);

  // ── Mouse wheel zoom (Ctrl/Cmd + scroll) ──────────────────────────────
  // Standard PDF-reader behavior: hold Ctrl (or Cmd on Mac) and scroll the
  // mouse wheel to zoom in/out. Without the modifier, the wheel scrolls the
  // page normally.
  //
  // The listener MUST be on `window` with `capture: true` — attaching to the
  // inner div only is too late: the browser's native Ctrl+wheel page-zoom is
  // dispatched at the window/document level and fires before the div's
  // handler, so preventDefault() on the div has no effect. Using capture at
  // the window level intercepts the event in the capture phase BEFORE the
  // browser's default zoom action runs.
  const pdfContentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;

    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Only intercept when the cursor is over the PDF content area
      const el = pdfContentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const overPdf =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!overPdf) return;

      // Ctrl/Cmd + wheel → zoom, not browser page zoom
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else if (e.deltaY > 0) {
        handleZoomOut();
      }
    };

    // capture:true so we run in the capture phase, before the browser's
    // default Ctrl+wheel zoom. passive:false so preventDefault() works.
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", handleWheel, { capture: true } as AddEventListenerOptions);
  }, [open, handleZoomIn, handleZoomOut]);

  if (!item) return null;

  const fileName = item.name || "Document.pdf";
  const fileSize = item.size;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.9)" } },
        paper: {
          elevation: 0,
          sx: {
            m: 0,
            backgroundColor: "var(--color-surface)",
          },
        },
      }}
      sx={{ zIndex: 10000 }}
    >
      <div className="media-viewer-container">
        {/* ── Reusable Header ─────────────────────────────────────────────── */}
        <MediaViewerHeader
          selectedCustomer={selectedCustomer}
          message={message}
          liveMessage={liveMessage}
          fileName={fileName}
          fileSize={fileSize}
          filePageCount={pageCount}
          onDownload={() => item.src && handleDownloadFile(item.src, fileName)}
          // On mobile+tablet, hide message action tools (reply/react/forward)
          // from the header — they're less relevant in a PDF viewer and the
          // toolbar is space-constrained. Download + close + zoom + annotation
          // are the essential tools on mobile.
          onReply={isTablet ? undefined : onReply}
          onForward={isTablet ? undefined : onForward}
          onQuickReaction={isTablet ? undefined : onQuickReaction}
          onRemoveReaction={isTablet ? undefined : onRemoveReaction}
          onClose={onClose}
          // Zoom buttons hidden on mobile+tablet — mobile users pinch-to-zoom
          // instead. Zoom state is kept for keyboard shortcuts (desktop only).
          zoom={isTablet ? undefined : { zoomIn: handleZoomIn, zoomOut: handleZoomOut, zoomLevel: zoom, onResetZoom: handleZoomReset }}
          extraToolbar={
            <>
              {/* ── Annotation tools (pen / rect / undo) ─────────────────────
                  Temporarily hidden — will be re-enabled in a future update
                  once both mobile + desktop annotation modes are implemented.
              <Tooltip title="Draw marker" arrow>
                <IconButton
                  className="toolbar-btn"
                  onClick={() => setAnnotationTool((tool) => tool === "pen" ? "none" : "pen")}
                  size="small"
                  sx={{ color: annotationTool === "pen" ? theme.palette.primary.main : undefined }}
                >
                  <Pencil size={18} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Highlight area" arrow>
                <IconButton
                  className="toolbar-btn"
                  onClick={() => setAnnotationTool((tool) => tool === "rect" ? "none" : "rect")}
                  size="small"
                  sx={{ color: annotationTool === "rect" ? theme.palette.primary.main : undefined }}
                >
                  <Square size={18} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Undo highlight" arrow>
                <span>
                  <IconButton
                    className="toolbar-btn"
                    size="small"
                    disabled={!annotations[currentPage]?.length}
                    onClick={() => setAnnotations((current) => ({
                      ...current,
                      [currentPage]: (current[currentPage] || []).slice(0, -1),
                    }))}
                  >
                    <Undo2 size={18} />
                  </IconButton>
                </span>
              </Tooltip>
              ──────────────────────────────────────────────────────────── */}
              <IconButton
                className="toolbar-btn"
                onClick={() => setSidebarOpen((v) => !v)}
                size="small"
                title={sidebarOpen ? "Hide thumbnails" : "Show thumbnails"}
              >
                {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
              </IconButton>
            </>
          }
        />

        {/* ── Body: sidebar + PDF content ─────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* ── Left sidebar: page thumbnails (DESKTOP — docked) ─────────── */}
          {/* On mobile+tablet the sidebar is rendered as a full-screen overlay
             outside this body div (see below) so it covers the header too. */}
          {sidebarOpen && pageCount > 0 && !isTablet && (
            <div
              className="pdf-thumb-sidebar"
              style={{
                width: 140,
                flexShrink: 0,
                height: "100%",
                overflowY: "auto",
                overflowX: "hidden",
                backgroundColor: theme.palette.mode === "dark" ? alpha("#000", 0.2) : alpha("#000", 0.03),
                borderRight: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                padding: "8px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  style={{
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 8,
                    border: `2px solid ${
                      currentPage === pageNum
                        ? theme.palette.primary.main
                        : "transparent"
                    }`,
                    transition: "border-color 0.15s, transform 0.15s",
                    transform: currentPage === pageNum ? "scale(1.02)" : "scale(1)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <canvas
                    ref={(el: HTMLCanvasElement | null) => {
                      thumbCanvasRefs.current[pageNum - 1] = el;
                    }}
                    style={{
                      display: "block",
                      maxWidth: THUMB_WIDTH,
                      maxHeight: 160,
                      borderRadius: 4,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                      background: "#fff",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: currentPage === pageNum
                        ? theme.palette.primary.main
                        : alpha(theme.palette.text.primary, 0.5),
                    }}
                  >
                    {pageNum}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── PDF content area ──────────────────────────────────────────── */}
          <div
            ref={pdfContentRef}
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              backgroundColor: theme.palette.mode === "dark" ? "#121220" : "#e8e8e8",
              display: "flex",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <PdfViewer
              src={item.src}
              fileName={fileName}
              zoom={zoom}
              onPdfLoaded={setPageCount}
              onPageChange={setCurrentPage}
              scrollToPageTrigger={scrollToPageTrigger}
              onPdfReady={handlePdfReady}
              annotationTool={annotationTool}
              annotations={annotations}
              onAnnotationsChange={setAnnotations}
            />
          </div>
        </div>

        {/* ── Page navigation footer (mobile+tablet) ──────────────────────── */}
        {/* Touch-friendly prev/next + page indicator. Hidden on desktop where
           keyboard arrows and the sidebar are the primary navigation. */}
        {isTablet && pageCount > 0 && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "8px 16px",
              paddingBottom: "calc(8px + var(--safe-bottom, 0px))",
              backgroundColor: "var(--color-surface)",
              borderTop: "1px solid var(--color-border)",
              zIndex: 100,
            }}
          >
            <IconButton
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              size="small"
              className="tap-target"
              aria-label="Previous page"
            >
              <ChevronUp size={22} />
            </IconButton>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                minWidth: 60,
                textAlign: "center",
                color: "var(--color-title)",
                userSelect: "none",
              }}
            >
              {currentPage} / {pageCount}
            </span>
            <IconButton
              onClick={goToNextPage}
              disabled={currentPage >= pageCount}
              size="small"
              className="tap-target"
              aria-label="Next page"
            >
              <ChevronDown size={22} />
            </IconButton>
          </div>
        )}

        {/* ── Full-screen thumbnail sidebar overlay (MOBILE+TABLET only) ─── */}
        {/* Covers the entire dialog including the header. Has its own
           mini-header with a close button. Opens when sidebarOpen is true. */}
        {isTablet && sidebarOpen && pageCount > 0 && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 200,
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
            />
            {/* Sidebar panel — full height, covers header */}
            <div
              className="pdf-thumb-sidebar pdf-thumb-sidebar--overlay"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 200,
                zIndex: 201,
                height: "100%",
                overflowY: "auto",
                overflowX: "hidden",
                backgroundColor: "var(--color-surface)",
                boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Mini-header for the overlay sidebar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  paddingTop: "calc(8px + var(--safe-top, 0px))",
                  minHeight: "calc(48px + var(--safe-top, 0px))",
                  borderBottom: "1px solid var(--color-border)",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-title)",
                  }}
                >
                  Pages
                </span>
                <IconButton
                  onClick={() => setSidebarOpen(false)}
                  size="small"
                  className="tap-target"
                  aria-label="Close thumbnails"
                >
                  <X size={20} />
                </IconButton>
              </div>
              {/* Thumbnails list */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "8px 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
                  <div
                    key={pageNum}
                    onClick={() => {
                      goToPage(pageNum);
                      setSidebarOpen(false);
                    }}
                    style={{
                      cursor: "pointer",
                      padding: 4,
                      borderRadius: 8,
                      border: `2px solid ${
                        currentPage === pageNum
                          ? theme.palette.primary.main
                          : "transparent"
                      }`,
                      transition: "border-color 0.15s, transform 0.15s",
                      transform: currentPage === pageNum ? "scale(1.02)" : "scale(1)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <canvas
                      ref={(el: HTMLCanvasElement | null) => {
                        thumbCanvasRefs.current[pageNum - 1] = el;
                      }}
                      style={{
                        display: "block",
                        maxWidth: THUMB_WIDTH,
                        maxHeight: 160,
                        borderRadius: 4,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                        background: "#fff",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: currentPage === pageNum
                          ? theme.palette.primary.main
                          : alpha(theme.palette.text.primary, 0.5),
                      }}
                    >
                      {pageNum}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};

export default memo(PdfViewerDialogComponent);
