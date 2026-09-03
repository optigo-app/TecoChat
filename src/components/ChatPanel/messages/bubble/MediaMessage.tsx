"use client";

import { memo, useState, useMemo } from "react";
import { Box, Skeleton, Typography, IconButton, useTheme, alpha } from "@mui/material";
import { FileText, Download, Play, FileSpreadsheet, FileArchive, FileCode, File, Smartphone } from "lucide-react";
import UploadProgressOverlay from "./UploadProgressOverlay";
import { CrossFadeImage, CrossFadeVideo } from "./CrossFadeMedia";
import PdfThumbnail from "./PdfThumbnail";
import { handleDownloadFile, getDocumentMeta } from "../../../../utils/globalFunc";
import { isTextFile } from "../../../../utils/txtUtils";
import type { ChatMessage } from "../../../../types/message";

interface MediaMessageProps {
  msg: ChatMessage;
  handleMediaClick?: (msg: ChatMessage, index: number) => void;
  getMediaKey: (msg: ChatMessage, index: number) => string;
  loadedMedia: Record<string, boolean>;
  markLoaded: (key: string) => void;
}

const MAX_GRID_ITEMS = 4;
const SINGLE_MEDIA_WIDTH = 250;
const GRID_SIZE = 250;

const formatSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MediaMessageComponent = ({
  msg,
  handleMediaClick,
  getMediaKey,
  loadedMedia,
  markLoaded,
}: MediaMessageProps) => {
  const theme = useTheme();
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);

  const initialDims = useMemo(() => {
    const w = Number((msg as { mediaWidth?: number }).mediaWidth);
    const h = Number((msg as { mediaHeight?: number }).mediaHeight);
    if (w > 0 && h > 0) return { w, h };
    const first = msg.mediaItems?.[0];
    const fw = Number(first?.width);
    const fh = Number(first?.height);
    if (fw > 0 && fh > 0) return { w: fw, h: fh };
    return null;
  }, [msg, msg.mediaItems]);

  // ── Image message (single or grid) ──────────────────────────────────────────
  if (msg.MessageType === "image") {
    const mediaItems = msg.mediaItems || [];
    const hasGrid = mediaItems.length > 1;
    const dimsForCalc = initialDims || imageDims;
    const computedHeight = dimsForCalc?.w && dimsForCalc?.h
      ? Math.max(100, Math.min(250, Math.round(SINGLE_MEDIA_WIDTH * (dimsForCalc.h / dimsForCalc.w))))
      : 200;

    if (hasGrid) {
      const visibleItems = mediaItems.slice(0, MAX_GRID_ITEMS);
      const overflowCount = mediaItems.length - MAX_GRID_ITEMS;
      // 2 images → 1 row × 2 cols (side by side); 3-4 → 2 rows × 2 cols
      const gridRows = mediaItems.length <= 2 ? "1fr" : "1fr 1fr";
      const gridHeight = mediaItems.length <= 2 ? 160 : GRID_SIZE;

      return (
        <Box sx={{ position: "relative" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: gridRows,
              gap: 0.5,
              width: GRID_SIZE,
              height: gridHeight,
              borderRadius: "12px",
              overflow: "hidden",
              backgroundColor: alpha(theme.palette.text.primary, 0.05),
            }}
          >
            {visibleItems.map((item, idx) => {
              const src = item.url || (idx === 0 ? msg.previewUrl : "") || "";
              const mKey = getMediaKey(msg, idx);
              const showOverflow = idx === MAX_GRID_ITEMS - 1 && overflowCount > 0;
              return (
                <Box
                  key={idx}
                  sx={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMediaClick?.(msg, idx);
                  }}
                >
                  {!loadedMedia[mKey] && (
                    <Skeleton
                      variant="rounded"
                      animation="wave"
                      sx={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        borderRadius: 0,
                        zIndex: 0,
                      }}
                    />
                  )}
                  {src && (
                    <Box sx={{ position: "relative", width: "100%", height: "100%", zIndex: 1 }}>
                      <CrossFadeImage
                        src={src}
                        alt={item.filename || "image"}
                        loaded={loadedMedia[mKey]}
                        markLoaded={markLoaded}
                        keyId={mKey}
                      />
                    </Box>
                  )}
                  {showOverflow && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: alpha("#000", 0.5),
                        color: "#fff",
                        fontSize: 20,
                        fontWeight: 600,
                        zIndex: 2,
                      }}
                    >
                      +{overflowCount}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
          {msg.isUploading && <UploadProgressOverlay percent={msg.percent || 0} />}
        </Box>
      );
    }

    const mediaKey = getMediaKey(msg, 0);
    const rawSrc = msg.previewUrl || msg.mediaItems?.[0]?.url || "";

    return (
      <Box sx={{ position: "relative" }}>
        <Box
          sx={{
            position: "relative",
            width: SINGLE_MEDIA_WIDTH,
            height: computedHeight,
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: alpha(theme.palette.text.primary, 0.05),
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleMediaClick?.(msg, 0);
          }}
        >
          {!loadedMedia[mediaKey] && (
            <Skeleton
              variant="rounded"
              animation="wave"
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                borderRadius: 0,
                zIndex: 0,
              }}
            />
          )}
          {rawSrc && (
            <Box sx={{ position: "relative", width: "100%", height: "100%", zIndex: 1 }}>
              <CrossFadeImage
                src={rawSrc}
                alt="media"
                loaded={loadedMedia[mediaKey]}
                markLoaded={markLoaded}
                keyId={mediaKey}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
                  }
                }}
              />
            </Box>
          )}
        </Box>
        {msg.isUploading && <UploadProgressOverlay percent={msg.percent || 0} />}
      </Box>
    );
  }

  // ── Video message (single or grid) ──────────────────────────────────────────
  if (msg.MessageType === "video") {
    const mediaItems = msg.mediaItems || [];
    const hasGrid = mediaItems.length > 1;

    if (hasGrid) {
      const visibleItems = mediaItems.slice(0, MAX_GRID_ITEMS);
      const overflowCount = mediaItems.length - MAX_GRID_ITEMS;
      // 2 videos → 1 row × 2 cols (side by side); 3-4 → 2 rows × 2 cols
      const gridRows = mediaItems.length <= 2 ? "1fr" : "1fr 1fr";
      const gridHeight = mediaItems.length <= 2 ? 160 : GRID_SIZE;

      return (
        <Box sx={{ position: "relative" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: gridRows,
              gap: 0.5,
              width: GRID_SIZE,
              height: gridHeight,
              borderRadius: "12px",
              overflow: "hidden",
              backgroundColor: alpha(theme.palette.text.primary, 0.05),
            }}
          >
            {visibleItems.map((item, idx) => {
              const src = item.url || (idx === 0 ? msg.previewUrl : "") || "";
              const mKey = getMediaKey(msg, idx);
              const showOverflow = idx === MAX_GRID_ITEMS - 1 && overflowCount > 0;
              return (
                <Box
                  key={idx}
                  sx={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMediaClick?.(msg, idx);
                  }}
                >
                  {!loadedMedia[mKey] && (
                    <Skeleton
                      variant="rounded"
                      animation="wave"
                      sx={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        borderRadius: 0,
                        zIndex: 0,
                      }}
                    />
                  )}
                  {src && (
                    <Box sx={{ position: "relative", width: "100%", height: "100%", zIndex: 1 }}>
                      <CrossFadeVideo
                        src={src}
                        loaded={loadedMedia[mKey]}
                        markLoaded={markLoaded}
                        keyId={mKey}
                      />
                    </Box>
                  )}
                  {/* Video icon overlay */}
                  <Box
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: alpha("#000", 0.5),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      pointerEvents: "none",
                    }}
                  >
                    <Play size={18} fill="currentColor" />
                  </Box>
                  {showOverflow && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: alpha("#000", 0.5),
                        color: "#fff",
                        fontSize: 20,
                        fontWeight: 600,
                        zIndex: 2,
                      }}
                    >
                      +{overflowCount}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
          {msg.isUploading && <UploadProgressOverlay percent={msg.percent || 0} />}
        </Box>
      );
    }

    const mediaKey = getMediaKey(msg, 0);
    const rawSrc = msg.previewUrl || msg.mediaItems?.[0]?.url || "";
    const dimsForCalc = initialDims || imageDims;
    const computedHeight = dimsForCalc?.w && dimsForCalc?.h
      ? Math.max(100, Math.min(250, Math.round(SINGLE_MEDIA_WIDTH * (dimsForCalc.h / dimsForCalc.w))))
      : 180;

    return (
      <Box sx={{ position: "relative" }}>
        <Box
          sx={{
            position: "relative",
            width: SINGLE_MEDIA_WIDTH,
            height: computedHeight,
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: alpha(theme.palette.text.primary, 0.05),
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleMediaClick?.(msg, 0);
          }}
        >
          {!loadedMedia[mediaKey] && (
            <Skeleton
              variant="rounded"
              animation="wave"
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                borderRadius: 0,
                zIndex: 0,
              }}
            />
          )}
          {rawSrc && (
            <Box sx={{ position: "relative", width: "100%", height: "100%", zIndex: 1 }}>
              <CrossFadeVideo
                src={rawSrc}
                loaded={loadedMedia[mediaKey]}
                markLoaded={markLoaded}
                keyId={mediaKey}
              />
            </Box>
          )}
          {/* Play button overlay */}
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: alpha("#000", 0.5),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <Play size={22} fill="currentColor" />
          </Box>
        </Box>
        {msg.isUploading && <UploadProgressOverlay percent={msg.percent || 0} />}
      </Box>
    );
  }

  // ── Document message ────────────────────────────────────────────────────────
  if (msg.MessageType === "document") {
    const mediaItems = msg.mediaItems || [];
    const hasMultiple = mediaItems.length > 1;

    // ── PDF: WhatsApp-style first-page thumbnail preview ───────────────────
    const isPdf = (item: { mimeType?: string; filename?: string }) =>
      item.mimeType === "application/pdf" ||
      (item.filename || "").toLowerCase().endsWith(".pdf");

    const pdfItems = mediaItems.filter(isPdf);
    const hasPdf = pdfItems.length > 0;

    if (hasPdf) {
      // Single PDF → thumbnail card
      if (pdfItems.length === 1 && !hasMultiple) {
        return (
          <Box sx={{ position: "relative" }}>
            <PdfThumbnail
              src={pdfItems[0].url || msg.previewUrl || ""}
              fileName={pdfItems[0].filename || msg.FileName || "Document.pdf"}
              fileSize={pdfItems[0].size}
              onClick={() => handleMediaClick?.(msg, mediaItems.indexOf(pdfItems[0]))}
            />
            {msg.isUploading && <UploadProgressOverlay percent={msg.percent || 0} size={40} />}
          </Box>
        );
      }

      // Multiple PDFs → stack of thumbnail cards
      return (
        <Box
          sx={{
            position: "relative",
            maxWidth: 350,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {pdfItems.map((item, idx) => (
            <PdfThumbnail
              key={idx}
              src={item.url}
              fileName={item.filename || "Document.pdf"}
              fileSize={item.size}
              onClick={() => handleMediaClick?.(msg, mediaItems.indexOf(item))}
            />
          ))}
          {msg.isUploading && <UploadProgressOverlay percent={msg.percent || 0} size={40} />}
        </Box>
      );
    }

    // ── Non-PDF documents: generic icon + filename row (unchanged) ────────

    const DocIconMap: Record<string, React.ComponentType<{ size?: number }>> = {
      FileText,
      FileSpreadsheet,
      FileArchive,
      FileCode,
      File,
      Smartphone,
    };

    const renderDocumentItem = (itemProps: { url?: string; filename?: string; fileName?: string; size?: number; mimeType?: string }, index: number) => {
      const href = itemProps.url || "";
      const name = itemProps.filename || itemProps.fileName || "Document";
      const meta = getDocumentMeta(name);
      const DocIcon = DocIconMap[meta.iconName] || File;
      const isTxt = isTextFile(name, itemProps.mimeType);

      return (
        <Box
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            // Text files → open preview dialog; other docs → download
            if (isTxt && href) {
              handleMediaClick?.(msg, index);
            } else if (href) {
              handleDownloadFile(href, name);
            }
          }}
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            width: 350,
            padding: "12px 16px",
            borderRadius: "12px",
            backgroundColor:
              msg.Direction === 1
                ? alpha(theme.palette.background.default, 0.2)
                : theme.palette.background.default,
            backdropFilter: "blur(1px)",
            cursor: "pointer",
            color: theme.palette.text.primary,
            transition: "all 0.2s",
          }}
        >
          {/* ICON */}
          <Box
            sx={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
            }}
          >
            {meta.iconUrl ? (
              <img
                src={meta.iconUrl}
                alt={meta.label}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <DocIcon size={24} />
            )}
          </Box>

          {/* FILE INFO */}
          <Box
            sx={{
              minWidth: 0,
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              gap: 0.2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={name}
            >
              {name}
            </Typography>

            <Typography
              variant="caption"
              sx={{
                color: alpha(theme.palette.text.primary, 0.8),
                fontWeight: 500,
                letterSpacing: "0.02em",
                display: "flex",
                alignItems: "center",
                gap: 0.8,
              }}
            >
              <span style={{ fontSize: "0.6rem" }}>{meta.label}</span>
              {itemProps.size != null && <span>• {formatSize(itemProps.size)}</span>}
            </Typography>
          </Box>

          {/* DOWNLOAD BUTTON */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              if (href) handleDownloadFile(href, name);
            }}
            sx={{
              color: "text.secondary",
              "&:hover": {
                bgcolor: "action.hover",
                color: "text.primary",
              },
            }}
            title="Download"
          >
            <Download size={18} />
          </IconButton>
        </Box>
      );
    };

    // MULTIPLE DOCUMENTS
    if (hasMultiple) {
      return (
        <div
          className="message-document-group"
          style={{
            position: "relative",
            maxWidth: 350,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {mediaItems.map((item, index) =>
            renderDocumentItem(
              { url: item.url, filename: item.filename, size: item.size, mimeType: item.mimeType },
              index
            )
          )}
          {msg.isUploading && <UploadProgressOverlay percent={msg.percent || 0} size={40} />}
        </div>
      );
    }

    // SINGLE DOCUMENT
    const fileName = msg.FileName || msg.mediaItems?.[0]?.filename || "Document";
    const rawSrc = msg.previewUrl || msg.mediaItems?.[0]?.url || "";

    return (
      <div
        className="message-document"
        style={{ position: "relative", maxWidth: 350, width: "100%" }}
      >
        {renderDocumentItem(
          { url: rawSrc, fileName, size: msg.mediaItems?.[0]?.size, mimeType: msg.mediaItems?.[0]?.mimeType },
          0
        )}
        {msg.isUploading && <UploadProgressOverlay percent={msg.percent || 0} size={40} />}
      </div>
    );
  }

  return null;
};

export default memo(MediaMessageComponent);
