"use client";

import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Box, Skeleton, IconButton, Tooltip, useTheme, alpha } from "@mui/material";
import { X, Trash2, Plus, SendHorizontal, ChevronLeft, ChevronRight, FileText, Smile } from "lucide-react";
import type { MediaFileItem } from "../CoreLogic/uiReducer";
import { getDocumentMeta } from "../../../utils/globalFunc";
import { LexicalChatEditor } from "../LexicalChatEditor";
import EmojiPickerPopper from "../input/EmojiPickerPopper";
import FormattingToolbar from "../input/FormattingToolbar";
import {
  CLEAR_EDITOR_COMMAND,
  $getSelection,
  $isRangeSelection,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type LexicalEditor,
} from "lexical";

interface MediaPreviewProps {
  open: boolean;
  mediaFiles: MediaFileItem[];
  onClose: () => void;
  onSend: (caption: string) => void;
  onRemoveMedia: (index: number) => void;
  onAddMore?: (files: File[]) => void;
  syncKey?: string | number;
}

const formatSize = (bytes?: number) => {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb > 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(1)} KB`;
};

const getExt = (name: string) => {
  const parts = (name || "").toLowerCase().split(".");
  if (parts.length < 2) return "";
  return parts.pop() || "";
};

const MediaPreviewComponent = ({
  open,
  mediaFiles,
  onClose,
  onSend,
  onRemoveMedia,
  onAddMore,
  syncKey,
}: MediaPreviewProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set());
  const [loadedThumbs, setLoadedThumbs] = useState<Set<string>>(new Set());
  const [showEmoji, setShowEmoji] = useState(false);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const textRef = useRef("");
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const thumbsScrollRef = useRef<HTMLDivElement | null>(null);
  const thumbItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset state when opening or switching conversation
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setCaption("");
      textRef.current = "";
      setLoadedVideos(new Set());
      setLoadedThumbs(new Set());
      // Clear the Lexical editor when opening
      if (editorRef.current) {
        editorRef.current.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
      }
    }
  }, [open, syncKey]);

  // Track caption text from Lexical editor (markdown output)
  const handleEditorChange = useCallback((val: string) => {
    textRef.current = val;
    setCaption(val);
  }, []);

  // Focus editor when overlay opens
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => editorRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Auto-scroll thumbnail strip to the active item (matches old Swiper Thumbs behavior)
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

  // Mouse wheel → horizontal scroll (since scrollbar is hidden)
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
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && !isEditorFocused()) {
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" && !isEditorFocused()) {
        setCurrentIndex((i) => Math.min(mediaFiles.length - 1, i + 1));
      }
    };
    const isEditorFocused = () => {
      const editorContainer = document.querySelector(".media-caption-editor .lexical-editor-container");
      return editorContainer && editorContainer.contains(document.activeElement);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, mediaFiles.length, onClose]);

  const currentMedia = mediaFiles[currentIndex];

  const currentFileMeta = useMemo(() => {
    if (!currentMedia) return { sizeText: "", extText: "", iconUrl: undefined as string | undefined };
    const sizeText = formatSize(currentMedia.size);
    const extText = getExt(currentMedia.name || "").toUpperCase();
    const meta = getDocumentMeta(currentMedia.name || "");
    return { sizeText, extText, iconUrl: meta.iconUrl };
  }, [currentMedia]);

  const totalSizeMB = useMemo(() => {
    const total = mediaFiles.reduce((acc, item) => acc + (item.size || 0), 0);
    return (total / (1024 * 1024)).toFixed(1);
  }, [mediaFiles]);

  const handleSend = useCallback(() => {
    const text = textRef.current.trim();
    onSend(text);
    textRef.current = "";
    setCaption("");
    if (editorRef.current) {
      editorRef.current.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
    }
  }, [onSend]);

  const handleVideoLoad = useCallback((id: string) => {
    setLoadedVideos((prev) => new Set(prev).add(id));
  }, []);

  const handleThumbLoad = useCallback((id: string) => {
    setLoadedThumbs((prev) => new Set(prev).add(id));
  }, []);

  const handleRemoveCurrent = useCallback(() => {
    if (mediaFiles.length === 0) return;
    onRemoveMedia(currentIndex);
    if (mediaFiles.length === 1) {
      onClose();
    } else {
      setCurrentIndex((i) => Math.min(i, mediaFiles.length - 2));
    }
  }, [currentIndex, mediaFiles, onRemoveMedia, onClose]);

  const handleRemoveThumb = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
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

  // ── Emoji insertion into Lexical editor ──────────────────────────────────
  const onEmojiClick = useCallback((emojiData: { emoji: string }) => {
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

  // ── Formatting toolbar: show on text selection ──────────────────────────
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

  // Close formatting toolbar on outside click
  useEffect(() => {
    if (!showFormattingToolbar) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const toolbar = document.querySelector(".formatting-toolbar");
      if (toolbar && toolbar.contains(target)) return;
      const editorContainer = document.querySelector(".media-caption-editor .lexical-editor-container");
      if (editorContainer && editorContainer.contains(target)) return;
      setShowFormattingToolbar(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showFormattingToolbar]);

  // Handle Enter key to send from Lexical editor
  const handleEditorKeyDown = useCallback(() => {
    handleSend();
  }, [handleSend]);

  if (!open || mediaFiles.length === 0) return null;

  // Helper to get preview URL for a media item
  const getMediaUrl = (item: MediaFileItem) => item.preview || (item.file ? URL.createObjectURL(item.file) : "");

  const surfaceBg = isDark ? "rgba(35, 35, 51, 0.92)" : "rgba(255, 255, 255, 0.92)";
  const headerBg = isDark ? "rgba(26, 26, 38, 0.95)" : "#fff";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const titleColor = theme.palette.text.primary;
  const subtitleColor = theme.palette.text.secondary;

  return (
    <div
      className="media-preview-overlay"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        background: "rgba(17, 24, 39, 0.28)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Inner overlay */}
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
        {/* ── Header ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            background: headerBg,
            borderBottom: `1px solid ${borderColor}`,
            paddingTop: "max(10px, var(--safe-top))",
            flexShrink: 0,
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close preview"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: `1px solid ${borderColor}`,
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
              color: titleColor,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <X size={20} />
          </button>

          {/* Title + subtitle */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              title={currentMedia?.name || ""}
              style={{
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                color: titleColor,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentMedia?.name || "Media preview"}
            </div>
            {currentMedia && (
              <div
                style={{
                  fontFamily: "inherit",
                  fontSize: 12,
                  color: subtitleColor,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {currentFileMeta.sizeText}
                {currentFileMeta.extText ? ` · ${currentFileMeta.extText}` : ""}
                {mediaFiles.length ? ` · ${currentIndex + 1} of ${mediaFiles.length}` : ""}
                {` · Total: ${totalSizeMB} MB`}
              </div>
            )}
          </div>

          {/* Trash */}
          <button
            onClick={handleRemoveCurrent}
            disabled={!currentMedia}
            aria-label="Remove current item"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: `1px solid ${borderColor}`,
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
              color: titleColor,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: currentMedia ? "pointer" : "not-allowed",
              opacity: currentMedia ? 1 : 0.5,
              transition: "all 0.2s ease",
            }}
          >
            <Trash2 size={20} />
          </button>
        </div>

        {/* ── Main Media Display ── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Navigation arrows */}
          {mediaFiles.length > 1 && currentIndex > 0 && (
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              style={{
                position: "absolute",
                left: 24,
                top: "50%",
                transform: "translateY(-50%)",
                width: 45,
                height: 45,
                borderRadius: "50%",
                border: `1px solid ${borderColor}`,
                background: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.92)",
                color: titleColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 5,
                boxShadow: "0 14px 34px rgba(17,24,39,0.14)",
                transition: "all 0.2s ease",
              }}
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {mediaFiles.length > 1 && currentIndex < mediaFiles.length - 1 && (
            <button
              onClick={() => setCurrentIndex((i) => Math.min(mediaFiles.length - 1, i + 1))}
              style={{
                position: "absolute",
                right: 24,
                top: "50%",
                transform: "translateY(-50%)",
                width: 45,
                height: 45,
                borderRadius: "50%",
                border: `1px solid ${borderColor}`,
                background: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.92)",
                color: titleColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 5,
                boxShadow: "0 14px 34px rgba(17,24,39,0.14)",
                transition: "all 0.2s ease",
              }}
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Media stage */}
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              overflow: "hidden",
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.55)",
              border: `1px solid ${borderColor}`,
              position: "relative",
            }}
          >
            {currentMedia?.type === "image" && (
              <img
                src={getMediaUrl(currentMedia)}
                alt={currentMedia.name || "media"}
                style={{
                  maxWidth: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            )}

            {currentMedia?.type === "video" && (
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
                      borderRadius: "16px",
                    }}
                  />
                )}
                <video
                  src={getMediaUrl(currentMedia)}
                  controls
                  onLoadedData={() => handleVideoLoad(currentMedia.name)}
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

            {currentMedia?.type === "file" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  textAlign: "center",
                  color: subtitleColor,
                  fontFamily: "inherit",
                  padding: 20,
                }}
              >
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                  {currentFileMeta.iconUrl ? (
                    <img src={currentFileMeta.iconUrl} alt="" style={{ width: 80, height: 80, objectFit: "contain" }} />
                  ) : (
                    <FileText size={80} color={theme.palette.primary.main} />
                  )}
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, color: titleColor, marginBottom: 4 }}>
                  {currentMedia.name}
                </div>
                <div style={{ fontSize: 13, color: subtitleColor, marginBottom: 12 }}>
                  {currentFileMeta.sizeText} · {currentFileMeta.extText}
                </div>
                <div style={{ fontSize: 14 }}>No preview available</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Thumbnails ── */}
        <div
          ref={thumbsScrollRef}
          className="media-preview-thumbs"
          style={{
            flexShrink: 0,
            padding: "12px 20px",
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.55)",
            borderTop: `1px solid ${borderColor}`,
            position: "relative",
            width: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            display: "flex",
            gap: 8,
            alignItems: "center",
            scrollBehavior: "smooth",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {mediaFiles.map((item, index) => {
            const isActive = index === currentIndex;
            const itemId = item.name;
            const isImage = item.type === "image";
            const isVideo = item.type === "video";
            const thumbSrc = isImage || isVideo ? getMediaUrl(item) : undefined;

            return (
              <div
                key={`${itemId}-${index}`}
                ref={(el) => { thumbItemRefs.current[index] = el; }}
                onClick={() => setCurrentIndex(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  flexShrink: 0,
                  width: 60,
                  height: 60,
                  borderRadius: 14,
                  overflow: "hidden",
                  cursor: "pointer",
                  border: isActive
                    ? `2px solid ${theme.palette.primary.main}`
                    : `1px solid ${borderColor}`,
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.75)",
                  boxShadow: isActive
                    ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`
                    : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {isVideo ? (
                  <>
                    {!loadedThumbs.has(itemId) && (
                      <Skeleton
                        variant="rectangular"
                        width="100%"
                        height="100%"
                        animation="wave"
                        sx={{ position: "absolute", inset: 0 }}
                      />
                    )}
                    <video
                      src={`${thumbSrc}#t=0.5`}
                      className="thumbnail-img is-video"
                      preload="metadata"
                      muted
                      onLoadedData={() => handleThumbLoad(itemId)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        opacity: loadedThumbs.has(itemId) ? 1 : 0,
                        transition: "opacity 0.3s ease",
                      }}
                    />
                  </>
                ) : isImage ? (
                  <img
                    src={thumbSrc}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {getDocumentMeta(mediaFiles[index]?.name || "").iconUrl ? (
                      <img
                        src={getDocumentMeta(mediaFiles[index]?.name || "").iconUrl}
                        alt=""
                        style={{ width: 28, height: 28, objectFit: "contain" }}
                      />
                    ) : (
                      <FileText size={28} color={theme.palette.primary.main} />
                    )}
                  </div>
                )}

                {/* Remove button on hover */}
                <button
                  onClick={(e) => handleRemoveThumb(e, index)}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    background: "rgba(0,0,0,0.7)",
                    border: "none",
                    color: "#fff",
                    borderRadius: "999px",
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    opacity: 0,
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  className="thumb-remove-btn"
                >
                  <X size={14} color="white" />
                </button>
              </div>
            );
          })}

          {/* Add more */}
          <div
            onClick={handleAddMore}
            title="Add more files"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 60,
              height: 60,
              borderRadius: 14,
              border: `2px dashed ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
          >
            <Plus size={24} color={subtitleColor} />
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            style={{ display: "none" }}
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.apk,.html,.htm,.py,.js,.jsx,.ts,.tsx,.css,.json,.xml,.zip,.rar,.7z,.sql,.log,.md,.rtf,.psd,.ai,.svg,.eps,.mp3,.wav,.ogg,.m4a,.flac,.aac,.wma,.mp4,.mov,.avi,.mkv,.flv,.wmv,.m4v,.webm"
          />
        </div>

        {/* ── Caption & Send ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 12,
            padding: "12px 20px",
            background: isDark ? "rgba(26,26,38,0.95)" : "rgba(255,255,255,0.95)",
            borderTop: `1px solid ${borderColor}`,
            paddingBottom: "max(12px, var(--safe-bottom))",
            flexShrink: 0,
          }}
        >
          {/* Caption wrapper with rich text editor */}
          <div
            className="media-caption-editor"
            ref={editorWrapperRef}
            onMouseUp={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(245,245,245,0.95)",
              borderRadius: 20,
              padding: "6px 12px",
              gap: 4,
              border: `1px solid ${borderColor}`,
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              minHeight: 44,
              position: "relative",
            }}
          >
            {/* Emoji button */}
            <Tooltip title="Emoji" arrow>
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                <IconButton
                  ref={emojiButtonRef}
                  size="small"
                  onClick={() => setShowEmoji((v) => !v)}
                  sx={{
                    color: subtitleColor,
                    width: 32,
                    height: 32,
                    "&:hover": { color: titleColor },
                  }}
                >
                  <Smile size={18} />
                </IconButton>
              </span>
            </Tooltip>

            <EmojiPickerPopper
              open={showEmoji}
              anchorEl={emojiButtonRef.current}
              onEmojiClick={onEmojiClick}
              onClose={() => setShowEmoji(false)}
              darkMode={isDark}
            />

            {/* Formatting toolbar (shows on text selection) */}
            {showFormattingToolbar && (
              <FormattingToolbar
                editorRef={editorRef}
                position={toolbarPosition}
              />
            )}

            {/* Rich text editor */}
            <LexicalChatEditor
              value={caption}
              onChange={handleEditorChange}
              onKeyDown={handleEditorKeyDown}
              placeholder="Add a caption..."
              editorRef={editorRef}
              syncKey={syncKey}
              namespace="MediaCaptionEditor"
              submitOnEnter={true}
              hasDraft={caption.trim().length > 0}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            aria-label="Send"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "none",
              background: theme.palette.primary.main,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s ease",
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.25)}`,
            }}
          >
            <SendHorizontal size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(MediaPreviewComponent);
