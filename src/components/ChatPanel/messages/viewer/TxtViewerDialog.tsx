"use client";

import { useState, useEffect, useRef, useMemo, memo } from "react";
import { Dialog, Box, Typography, IconButton, Tooltip, useTheme, alpha, CircularProgress } from "@mui/material";
import { FileText, Code, Eye } from "lucide-react";
import { handleDownloadFile } from "../../../../utils/globalFunc";
import { loadTextFile } from "../../../../utils/txtUtils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MediaViewerHeader from "./MediaViewerHeader";
import type { MediaViewerItem } from "../../CoreLogic/uiReducer";
import type { ChatMessage } from "../../../../types/message";
import type { ConversationListEntry } from "../../../../types/conversation";

// .md/.markdown always render formatted. For .txt/.log/etc. we sniff the
// content — pasted ChatGPT/LLM output arrives as .txt but is full of
// markdown (##, **bold**, - lists, ``` fences) which is unreadable raw.
const looksLikeMarkdown = (fileName: string, text: string): boolean => {
  if (/\.(md|markdown)$/i.test(fileName)) return true;
  if (!text) return false;
  return (
    /(^|\n)#{1,6}\s+\S/.test(text) || // headings
    /```[\s\S]*?```/.test(text) || // code fences
    /(^|\n)\s*[-*]\s+\S/.test(text) || // bullet lists
    /(^|\n)\s*\d+\.\s+\S/.test(text) || // ordered lists
    /(^|\n)>\s*\S/.test(text) || // blockquotes
    /\*\*\S[^*\n]*\S\*\*/.test(text) || // **bold**
    /\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(text) // [links](url)
  );
};

interface TxtViewerDialogProps {
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

const TxtViewerDialogComponent = ({
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
}: TxtViewerDialogProps) => {
  const theme = useTheme();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // null = auto (formatted when content looks like markdown, else raw)
  const [viewMode, setViewMode] = useState<"formatted" | "raw" | null>(null);
  const cancelledRef = useRef(false);

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

  // Load text content when dialog opens
  useEffect(() => {
    if (!open || !item?.src) return;

    cancelledRef.current = false;
    setLoading(true);
    setError(false);
    setContent("");
    setViewMode(null);

    (async () => {
      try {
        const text = await loadTextFile(item.src!);
        if (cancelledRef.current) return;
        setContent(text);
        setLoading(false);
      } catch (err) {
        if (cancelledRef.current) return;
        console.error("[TxtViewerDialog] Failed to load text:", err);
        setError(true);
        setLoading(false);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [open, item?.src]);

  const isMarkdown = useMemo(
    () => looksLikeMarkdown(item?.name || "", content),
    [item?.name, content]
  );
  const effectiveView = viewMode ?? (isMarkdown ? "formatted" : "raw");

  if (!item) return null;

  const fileName = item.name || "Document.txt";
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
          onDownload={() => item.src && handleDownloadFile(item.src, fileName)}
          onReply={onReply}
          onForward={onForward}
          onQuickReaction={onQuickReaction}
          onRemoveReaction={onRemoveReaction}
          onClose={onClose}
          extraToolbar={
            !loading && !error ? (
              <Tooltip
                title={effectiveView === "formatted" ? "View raw text" : "View formatted"}
                placement="bottom"
                slotProps={{ popper: { sx: { zIndex: 11000 } } }}
              >
                <IconButton
                  className="toolbar-btn"
                  size="small"
                  onClick={() =>
                    setViewMode(effectiveView === "formatted" ? "raw" : "formatted")
                  }
                >
                  {effectiveView === "formatted" ? <Code size={18} /> : <Eye size={18} />}
                </IconButton>
              </Tooltip>
            ) : undefined
          }
        />

        {/* ── Body: scrollable text content ──────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            position: "relative",
            backgroundColor: theme.palette.mode === "dark" ? "#121220" : "#f5f5f5",
            padding: "16px",
            paddingBottom: "max(16px, var(--safe-bottom, 0px))",
          }}
        >
          {loading && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 2,
                color: "text.secondary",
              }}
            >
              <CircularProgress size={28} />
              <Typography variant="body2">Loading text…</Typography>
            </Box>
          )}

          {error && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 1,
                color: alpha(theme.palette.text.primary, 0.4),
              }}
            >
              <FileText size={48} />
              <Typography variant="body2">Failed to load text preview</Typography>
              <Typography
                variant="caption"
                sx={{ color: alpha(theme.palette.text.primary, 0.5), cursor: "pointer" }}
                onClick={() => item.src && handleDownloadFile(item.src, fileName)}
              >
                Click here to download instead
              </Typography>
            </Box>
          )}

          {/* Content rendered inside a centered "page" card — like the PDF
              viewer centers its page — instead of spanning the full width. */}
          {!loading && !error && (
            <div
              style={{
                maxWidth: 860,
                width: "100%",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border-light)",
                  borderRadius: 12,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
                  padding: "clamp(16px, 3vw, 36px)",
                }}
              >
                {effectiveView === "raw" ? (
                  <pre
                    style={{
                      margin: 0,
                      padding: 0,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: theme.palette.text.primary,
                      userSelect: "text",
                      WebkitUserSelect: "text",
                    }}
                  >
                    {content}
                  </pre>
                ) : (
                  <div
                    className="md-body"
                    style={{
                      userSelect: "text",
                      WebkitUserSelect: "text",
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default memo(TxtViewerDialogComponent);
