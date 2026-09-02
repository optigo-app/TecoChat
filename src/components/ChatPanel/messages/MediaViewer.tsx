"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Dialog, IconButton, Tooltip, Avatar, Skeleton, Box, useTheme, alpha } from "@mui/material";
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  ZoomIn,
  ZoomOut,
  Reply,
  Forward,
  Smartphone,
  Smile,
} from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Mousewheel, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "./MediaViewer.scss";
import {
  handleDownloadFile,
  getCustomerDisplayName,
  getWhatsAppAvatarConfig,
  getCustomerAvatarSeed,
  hasCustomerName,
  getDocumentMeta,
} from "../../../utils/globalFunc";
import { formatDateTime } from "../../../utils/dateUtils";
import { Emoji, EmojiStyle } from "emoji-picker-react";
import { charToUnified, parseReactions } from "../../../utils/EmojiUtils";
import { User } from "lucide-react";
import QuickReactionMenu from "./QuickReactionMenu";
import ReactionDetailsMenu from "./ReactionDetailsMenu";
import type { MediaViewerItem } from "../CoreLogic/uiReducer";
import type { ChatMessage } from "../../../types/message";
import type { ConversationListEntry } from "../../../types/conversation";

interface MediaViewerProps {
  open: boolean;
  items: MediaViewerItem[];
  initialIndex?: number;
  message?: ChatMessage | null;
  messages?: ChatMessage[] | { data?: ChatMessage[] };
  selectedCustomer?: ConversationListEntry | null;
  currentUserId?: string | number;
  onClose: () => void;
  onReply?: (msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage, event?: React.MouseEvent) => void;
  onQuickReaction?: (emoji: string, msg: ChatMessage) => void;
  onRemoveReaction?: (reaction: { Emoji?: string; Reaction?: string }, msg: ChatMessage) => void;
}

const MediaViewerComponent = ({
  open,
  items,
  initialIndex = 0,
  message,
  messages,
  selectedCustomer,
  currentUserId,
  onClose,
  onReply,
  onForward,
  onQuickReaction,
  onRemoveReaction,
}: MediaViewerProps) => {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const swiperRef = useRef<{ slidePrev: () => void; slideNext: () => void; slideTo: (i: number) => void; slideToLoop: (i: number) => void; realIndex: number; activeIndex: number; el: Element } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const prevIndexRef = useRef(initialIndex);
  const thumbsScrollRef = useRef<HTMLDivElement | null>(null);
  const thumbItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reactionButtonRef = useRef<HTMLButtonElement | null>(null);
  const [reactionAnchorEl, setReactionAnchorEl] = useState<HTMLElement | null>(null);
  const [detailAnchorEl, setDetailAnchorEl] = useState<HTMLElement | null>(null);

  // Sync with the actual messages array to get live reaction updates
  const liveMessage = useMemo(() => {
    const list = Array.isArray(messages)
      ? messages
      : Array.isArray((messages as { data?: ChatMessage[] })?.data)
        ? (messages as { data: ChatMessage[] }).data
        : [];
    const found = list.find(
      (m) => String(m.Id || m.MessageId) === String(message?.Id || message?.MessageId)
    );
    return found || message;
  }, [messages, message]);

  const parsedReactions = useMemo(
    () => parseReactions(liveMessage?.ReactionEmojis),
    [liveMessage?.ReactionEmojis]
  );

  const enableLoop = items.length > 1;

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const pauseVideosInElement = useCallback((rootEl: Element | null | undefined) => {
    if (!rootEl || typeof rootEl.querySelectorAll !== "function") return;
    const videos = rootEl.querySelectorAll("video");
    videos.forEach((video) => {
      try {
        if (video && typeof video.pause === "function" && !video.paused) {
          video.pause();
        }
      } catch {
        /* ignore */
      }
    });
  }, []);

  const markLoaded = useCallback((key: number) => {
    setLoading((prev) => ({ ...prev, [key]: false }));
  }, []);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      const initState: Record<number, boolean> = {};
      items.forEach((_, idx) => {
        initState[idx] = true;
      });
      setLoading(initState);
      resetZoom();
    }
  }, [open, initialIndex, items, resetZoom]);

  // Auto-scroll thumbnail strip to the active item (matches old Swiper Thumbs behavior)
  useEffect(() => {
    if (!open) return;
    const el = thumbItemRefs.current[currentIndex];
    if (!el || !thumbsScrollRef.current) return;
    const container = thumbsScrollRef.current;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    if (elLeft < viewLeft) {
      container.scrollTo({ left: elLeft - 10, behavior: "smooth" });
    } else if (elRight > viewRight) {
      container.scrollTo({ left: elRight - container.clientWidth + 10, behavior: "smooth" });
    }
  }, [currentIndex, open]);

  // Mouse wheel → horizontal scroll for thumbnail strip (scrollbar is hidden)
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.2, 0.5);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoomLevel > 1) {
      draggingRef.current = true;
      startPosRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingRef.current && zoomLevel > 1) {
      const newX = e.clientX - startPosRef.current.x;
      const newY = e.clientY - startPosRef.current.y;
      setOffset({ x: newX, y: newY });
    }
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase?.() || "";
      const isTypingTarget = Boolean(
        (target as HTMLElement)?.isContentEditable ||
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select"
      );
      if (isTypingTarget || e.altKey) return;

      if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.code === "NumpadSubtract") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0" || e.code === "Digit0" || e.code === "Numpad0") {
        e.preventDefault();
        resetZoom();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleZoomIn, handleZoomOut, resetZoom, onClose]);

  const handlePrev = useCallback(() => {
    if (swiperRef.current?.slidePrev) {
      swiperRef.current.slidePrev();
    } else {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    }
  }, [items.length]);

  const handleNext = useCallback(() => {
    if (swiperRef.current?.slideNext) {
      swiperRef.current.slideNext();
    } else {
      setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    }
  }, [items.length]);

  if (!open || items.length === 0) return null;

  const currentMedia = items[currentIndex];
  const time = message?.Time || (message?.DateTime ? formatDateTime(message.DateTime, "time") : "");

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          onClose();
        }
      }}
      sx={{ zIndex: 10000 }}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: "rgba(0, 0, 0, 0.85)" },
        },
        paper: {
          elevation: 0,
          sx: { m: 0, backgroundColor: "var(--color-surface)" },
        },
      }}
      maxWidth={false}
      fullScreen
    >
      <div className="media-viewer-container">
        {/* Header */}
        <div className="media-viewer-header">
          <div className="media-viewer-header-left">
            {selectedCustomer && (
              <>
                {!hasCustomerName(selectedCustomer) ? (
                  <Avatar
                    {...getWhatsAppAvatarConfig(getCustomerAvatarSeed(selectedCustomer), 32)}
                  >
                    <User size={20} />
                  </Avatar>
                ) : (
                  <Avatar {...getWhatsAppAvatarConfig(getCustomerDisplayName(selectedCustomer), 32)} />
                )}
                <div className="media-viewer-user-info">
                  <div className="media-viewer-username">
                    {getCustomerDisplayName(selectedCustomer)}
                  </div>
                  {time && <div className="media-viewer-timestamp">{time}</div>}
                </div>
              </>
            )}
          </div>

          <div className="media-viewer-header-right">
            <div className="media-viewer-toolbar">
              {currentMedia?.type === "image" && (
                <>
                  <Tooltip title="Zoom In" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
                    <IconButton className="toolbar-btn" onClick={handleZoomIn} size="small">
                      <ZoomIn size={18} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Zoom Out" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
                    <IconButton className="toolbar-btn" onClick={handleZoomOut} size="small">
                      <ZoomOut size={18} />
                    </IconButton>
                  </Tooltip>
                  <div className="toolbar-divider" />
                </>
              )}
              {onReply && message && (
                <Tooltip title="Reply" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
                  <IconButton
                    className="toolbar-btn"
                    onClick={() => {
                      onReply(liveMessage || message);
                      onClose();
                    }}
                    size="small"
                  >
                    <Reply size={18} />
                  </IconButton>
                </Tooltip>
              )}
              {onQuickReaction && message && (
                <>
                  <Tooltip title="React" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
                    <IconButton
                      ref={reactionButtonRef}
                      className="toolbar-btn reaction-btn"
                      onClick={(e) => setReactionAnchorEl(e.currentTarget)}
                      size="small"
                    >
                      <Smile size={18} />
                    </IconButton>
                  </Tooltip>
                  <QuickReactionMenu
                    open={Boolean(reactionAnchorEl)}
                    anchorEl={reactionAnchorEl}
                    hideTrigger={true}
                    disablePortal={true}
                    onClose={() => setReactionAnchorEl(null)}
                    onSelectEmoji={(emoji: string) => {
                      if (onQuickReaction) onQuickReaction(emoji, liveMessage || message!);
                      setReactionAnchorEl(null);
                    }}
                  />
                </>
              )}
              {onForward && message && (
                <Tooltip title="Forward" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
                  <IconButton
                    className="toolbar-btn"
                    onClick={() => {
                      onForward(liveMessage || message);
                      onClose();
                    }}
                    size="small"
                  >
                    <Forward size={18} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Download" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
                <IconButton
                  className="toolbar-btn"
                  onClick={() => handleDownloadFile(currentMedia?.src, currentMedia?.name)}
                  size="small"
                >
                  <Download size={18} />
                </IconButton>
              </Tooltip>
              <div className="toolbar-divider" />
              <Tooltip title="Close" placement="bottom" slotProps={{ popper: { sx: { zIndex: 11000 } } }}>
                <IconButton className="toolbar-btn media-viewer-close" onClick={onClose} size="small">
                  <X size={20} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Media Display Area */}
        <div className="media-viewer-content">
          {items.length > 1 && (
            <button className="media-viewer-nav prev" onClick={handlePrev} aria-label="Previous">
              <ChevronLeft size={25} />
            </button>
          )}

          <div className="media-viewer-display">
            <Swiper
              className="media-viewer-swiper"
              initialSlide={initialIndex}
              loop={enableLoop}
              allowTouchMove={enableLoop}
              slidesPerView={1}
              resizeObserver={false}
              observer={false}
              observeParents={false}
              onSwiper={(swiper) => {
                swiperRef.current = swiper as typeof swiperRef.current;
              }}
              onSlideChangeTransitionStart={(swiper) => {
                pauseVideosInElement(swiper?.el);
              }}
              onSlideChange={(swiper) => {
                const nextIndex =
                  typeof swiper?.realIndex === "number" ? swiper.realIndex : swiper.activeIndex;
                if (prevIndexRef.current !== nextIndex) {
                  prevIndexRef.current = nextIndex;
                  setCurrentIndex(nextIndex);
                  resetZoom();
                }
              }}
              keyboard={{ enabled: true }}
              mousewheel={true}
              modules={[Keyboard, Mousewheel, Navigation]}
            >
              {items.map((item, index) => {
                const slideLoading = loading[index];
                return (
                  <SwiperSlide key={index}>
                    <div className="media-viewer-slide">
                      {item?.type === "image" && (
                        <>
                          {slideLoading && (
                            <Skeleton
                              variant="rectangular"
                              width="100%"
                              height="100%"
                              sx={{
                                bgcolor: theme.palette.mode === "dark"
                                  ? "rgba(255, 255, 255, 0.08)"
                                  : "rgba(0, 0, 0, 0.06)",
                                borderRadius: "12px",
                                position: "absolute",
                                maxWidth: "min(900px, 90%)",
                                maxHeight: "min(700px, 80%)",
                              }}
                              animation="wave"
                            />
                          )}
                          <img
                            src={item.src}
                            alt={item.name || "Image"}
                            className={`media-content ${slideLoading ? "loading" : "loaded"}`}
                            onLoad={() => markLoaded(index)}
                            onError={() => markLoaded(index)}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            style={{
                              display: slideLoading ? "none" : "block",
                              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomLevel})`,
                              transition: draggingRef.current ? "none" : "transform 0.2s ease-in-out",
                              cursor: zoomLevel > 1 ? (draggingRef.current ? "grabbing" : "grab") : "default",
                              touchAction: "none",
                            }}
                          />
                        </>
                      )}

                      {item?.type === "video" && (
                        <>
                          {slideLoading && (
                            <Skeleton
                              variant="rectangular"
                              width="100%"
                              height="100%"
                              sx={{
                                bgcolor: theme.palette.mode === "dark"
                                  ? "rgba(255, 255, 255, 0.08)"
                                  : "rgba(0, 0, 0, 0.06)",
                                borderRadius: "12px",
                                position: "absolute",
                                maxWidth: "min(800px, 90%)",
                                maxHeight: "min(600px, 80%)",
                              }}
                              animation="wave"
                            />
                          )}
                          <video
                            src={item.src}
                            className="media-content"
                            controls
                            onLoadedData={() => markLoaded(index)}
                            onCanPlay={() => markLoaded(index)}
                            onError={() => markLoaded(index)}
                            style={{
                              display: slideLoading ? "none" : "block",
                              maxWidth: "90%",
                              maxHeight: "80%",
                              borderRadius: "12px",
                            }}
                          />
                        </>
                      )}

                      {item?.type === "document" && (
                        (() => {
                          const meta = getDocumentMeta(item.name || "");
                          const IconMap: Record<string, React.ComponentType<{ size?: number }>> = {
                            FileText,
                            FileSpreadsheet,
                            FileArchive,
                            FileCode,
                            File,
                            Smartphone,
                          };
                          const DocIcon = IconMap[meta.iconName] || File;
                          const formatSize = (bytes?: number) => {
                            if (!bytes) return "";
                            if (bytes < 1024) return `${bytes} B`;
                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                          };

                          return (
                            <div className="document-preview">
                              <div className="document-header">
                                <div
                                  className={`document-icon ${meta.iconUrl ? "" : meta.tone}`}
                                  style={meta.iconUrl ? { background: "none", padding: 0 } : {}}
                                >
                                  {meta.iconUrl ? (
                                    <img
                                      src={meta.iconUrl}
                                      alt={meta.label}
                                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                    />
                                  ) : (
                                    <DocIcon size={36} />
                                  )}
                                </div>
                                <div className="document-info">
                                  <div className="document-name">{item.name || "Document"}</div>
                                  <div className="document-size">{formatSize(item.size)}</div>
                                </div>
                              </div>
                              <div className="document-actions">
                                <button
                                  type="button"
                                  className="document-action primary"
                                  onClick={() => handleDownloadFile(item?.src, item?.name)}
                                >
                                  <Download size={18} />
                                  Download
                                </button>
                              </div>
                            </div>
                          );
                        })()
                      )}

                      {/* Reaction Overlay (bottom-left, matches old code) */}
                      {liveMessage?.ReactionEmojis &&
                        liveMessage.ReactionEmojis !== "" &&
                        liveMessage.ReactionEmojis !== "[]" && (
                          <Box
                            className="media-viewer-reaction-group"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailAnchorEl(e.currentTarget);
                            }}
                          >
                            <div className="reaction-pills">
                              {(() => {
                                try {
                                  const reactions = JSON.parse(liveMessage.ReactionEmojis);
                                  if (Array.isArray(reactions)) {
                                    const uniqueEmojis = [
                                      ...new Set(reactions.map((r) => r?.Reaction || r?.Emoji)),
                                    ].slice(0, 3);
                                    return (
                                      <div className="reaction-icons">
                                        {uniqueEmojis.map((emojiChar, idx) => {
                                          const unified = charToUnified(emojiChar);
                                          return unified ? (
                                            <Emoji
                                              key={idx}
                                              unified={unified}
                                              size={20}
                                              emojiStyle={EmojiStyle.APPLE}
                                            />
                                          ) : (
                                            <span key={idx}>{emojiChar}</span>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                } catch {
                                  /* ignore */
                                }
                                return null;
                              })()}
                            </div>
                          </Box>
                        )}
                    </div>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </div>

          {/* Reaction Details Menu */}
          {liveMessage?.ReactionEmojis && onRemoveReaction && (
            <ReactionDetailsMenu
              anchorEl={detailAnchorEl}
              onClose={() => setDetailAnchorEl(null)}
              reactions={parsedReactions}
              currentUserId={currentUserId}
              disablePortal={true}
              onRemoveReaction={(reaction) => {
                onRemoveReaction(reaction, liveMessage || message!);
                setDetailAnchorEl(null);
              }}
            />
          )}

          {items.length > 1 && (
            <button className="media-viewer-nav next" onClick={handleNext} aria-label="Next">
              <ChevronRight size={25} />
            </button>
          )}
        </div>

        {/* Caption */}
        {message?.Message && (
          <Box className="media-viewer-caption">
            {message.Message}
          </Box>
        )}

        {/* Footer / Thumbnails */}
        <div className="media-viewers-footer">
          <div className="media-count">
            {currentIndex + 1} of {items.length}
          </div>
          {items.length > 1 && (
            <div ref={thumbsScrollRef} className="media-viewer-thumbnails">
              {items.map((item, index) => (
                <div
                  key={index}
                  ref={(el) => { thumbItemRefs.current[index] = el; }}
                  className={`thumbnail ${index === currentIndex ? "active" : ""}`}
                  onClick={() => {
                    if (swiperRef.current?.slideToLoop) {
                      swiperRef.current.slideToLoop(index);
                      return;
                    }
                    if (swiperRef.current?.slideTo) {
                      swiperRef.current.slideTo(index);
                      return;
                    }
                    setCurrentIndex(index);
                  }}
                >
                  {item.type === "image" && (
                    <img src={item.src} alt={`Thumbnail ${index}`} />
                  )}
                  {item.type === "video" && (
                    <div className="thumbnail-video">
                      <img
                        src="/icons/video.png"
                        alt="Video"
                        className="thumbnail-video-icon"
                      />
                    </div>
                  )}
                  {item.type === "document" && (
                    (() => {
                      const meta = getDocumentMeta(item.name || "");
                      const IconMap: Record<string, React.ComponentType<{ size?: number }>> = {
                        FileText,
                        FileSpreadsheet,
                        FileArchive,
                        FileCode,
                        File,
                        Smartphone,
                      };
                      const DocIcon = IconMap[meta.iconName] || File;
                      return (
                        <div className="thumbnail-document">
                          <div
                            className={`thumbnail-icon ${meta.iconUrl ? "" : meta.tone}`}
                            style={meta.iconUrl ? { background: "none", padding: 0 } : {}}
                          >
                            {meta.iconUrl ? (
                              <img
                                src={meta.iconUrl}
                                alt={meta.label}
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              />
                            ) : (
                              <DocIcon size={22} />
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default memo(MediaViewerComponent);
