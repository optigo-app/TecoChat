"use client";

import { memo, useRef, useState, useLayoutEffect, useEffect, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { renderMessageText } from "../../../../utils/messageTextRenderer";

const TOLERANCE = 1;

interface ReadMoreTextProps {
  content: string;
  maxLines?: number;
  minChars?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  sx?: object;
  mentionUsers?: string | null;
  highlightQuery?: string | null;
}

const ReadMoreTextComponent = ({
  content,
  maxLines = 5,
  minChars = 2000,
  isExpanded = false,
  onToggle,
  sx = {},
  mentionUsers,
  highlightQuery,
}: ReadMoreTextProps) => {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [needsToggle, setNeedsToggle] = useState(false);
  const shouldAllowTruncate = content.length >= minChars;

  const measure = useCallback(() => {
    const el = textRef.current;
    if (!el) return;

    if (!shouldAllowTruncate) {
      // Clear any leftover inline styles so the element renders fully
      el.style.display = "";
      el.style.webkitLineClamp = "";
      el.style.webkitBoxOrient = "";
      el.style.overflow = "";
      setNeedsToggle(false);
      return;
    }

    // Force line clamp for measurement regardless of current state
    el.style.display = "-webkit-box";
    el.style.webkitBoxOrient = "vertical";
    el.style.webkitLineClamp = String(maxLines);
    el.style.overflow = "hidden";

    const truncated = el.scrollHeight > el.clientHeight + TOLERANCE;

    // Always clean up inline styles — let CSS classes (.read-more-text /
    // .read-more-text.expanded) control the visual state.  Leaving the
    // forced inline styles behind would override the .expanded class
    // (inline styles beat class styles), preventing the message from
    // actually expanding when the user clicks "Read more".
    el.style.display = "";
    el.style.webkitLineClamp = "";
    el.style.webkitBoxOrient = "";
    el.style.overflow = "";

    setNeedsToggle((prev) => (prev === truncated ? prev : truncated));
  }, [maxLines, shouldAllowTruncate]);

  useLayoutEffect(() => {
    measure();
  }, [measure, content, maxLines, minChars]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <>
      <Box
        ref={textRef}
        className={`read-more-text ${isExpanded || !shouldAllowTruncate ? "expanded" : ""}`}
        style={{ ["--read-more-lines" as string]: maxLines } as React.CSSProperties}
        sx={{
          color: "text.primary",
          fontSize: 14,
          lineHeight: 1.45,
          pr: 1,
          maxWidth: "100%",
          ...sx,
        }}
      >
        {renderMessageText(content, mentionUsers, highlightQuery ?? undefined)}
      </Box>
      {needsToggle && (
        <Typography
          variant="caption"
          component="span"
          sx={{
            color: "primary.main",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 500,
            ml: 0.5,
            "&:hover": { textDecoration: "underline" },
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
        >
          {isExpanded ? "Read less" : "Read more"}
        </Typography>
      )}
    </>
  );
};

export default memo(ReadMoreTextComponent);
