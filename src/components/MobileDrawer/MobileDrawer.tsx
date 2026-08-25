"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Box, IconButton } from "@mui/material";
import { X } from "lucide-react";
import { useIsMobile } from "../../hooks/useIsMobile";

interface MobileDrawerProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Called when the drawer should close (backdrop click, swipe, X button). */
  onClose: () => void;
  /** Drawer content. */
  children: React.ReactNode;
  /** Drawer width on mobile (px). Default 300. */
  width?: number;
  /** Which side the drawer slides from. */
  side?: "left" | "right";
  /** Title shown in the drawer header (optional). */
  title?: React.ReactNode;
}

/**
 * App-like slide-out drawer for mobile. On tablet/desktop it renders children
 * inline (no overlay) so it can double as a docked panel.
 *
 * Features:
 * - Backdrop with fade animation
 * - Swipe-to-close gesture (touch start on drawer, drag toward the edge)
 * - Respects safe-area insets
 * - Prevents body scroll when open on mobile
 */
export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  open,
  onClose,
  children,
  width = 300,
  side = "right",
  title,
}) => {
  const isMobile = useIsMobile();
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = React.useRef(0);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (!isMobile || !open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isMobile, open]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setDragging(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX.current;
      // Only allow dragging toward the close direction
      if (side === "right") {
        setDragOffset(Math.max(0, dx));
      } else {
        setDragOffset(Math.min(0, dx));
      }
    },
    [dragging, side]
  );

  const onTouchEnd = useCallback(() => {
    setDragging(false);
    // If dragged more than 40% of width, close
    const threshold = width * 0.4;
    if (Math.abs(dragOffset) > threshold) {
      onClose();
    }
    setDragOffset(0);
  }, [dragOffset, width, onClose]);

  // ── Desktop / tablet: render inline (docked panel) ──────────────────────
  if (!isMobile) {
    return (
      <Box
        sx={{
          width,
          flexShrink: 0,
          height: "100%",
          bgcolor: "background.paper",
          borderLeft: side === "right" ? "1px solid" : "none",
          borderRight: side === "left" ? "1px solid" : "none",
          borderColor: "divider",
          overflow: "auto",
        }}
      >
        {children}
      </Box>
    );
  }

  // ── Mobile: overlay drawer ──────────────────────────────────────────────
  const translateX =
    side === "right"
      ? `calc(100% + ${dragOffset}px)`
      : `calc(-100% + ${dragOffset}px)`;

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        sx={{
          position: "fixed",
          inset: 0,
          bgcolor: "rgba(0,0,0,0.5)",
          zIndex: 1200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: dragging ? "none" : "opacity 200ms ease",
        }}
      />
      {/* Drawer panel */}
      <Box
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        sx={{
          position: "fixed",
          top: 0,
          bottom: 0,
          [side]: 0,
          width,
          maxWidth: "85vw",
          bgcolor: "background.paper",
          zIndex: 1201,
          transform: open ? translateX : `translateX(${side === "right" ? "100%" : "-100%"})`,
          transition: dragging ? "none" : "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "var(--safe-top)",
          paddingBottom: "var(--safe-bottom)",
          boxShadow: "var(--shadow-paper)",
          willChange: "transform",
        }}
      >
        {/* Header with close button */}
        {title && (
          <Box
            className="no-select app-header"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
              flexShrink: 0,
            }}
          >
            <Box sx={{ fontWeight: 600, fontSize: "1rem" }}>{title}</Box>
            <IconButton onClick={onClose} size="small" className="tap-target">
              <X size={20} />
            </IconButton>
          </Box>
        )}
        {/* Scrollable content */}
        <Box className="app-scroll" sx={{ flex: 1, overflow: "auto" }}>
          {children}
        </Box>
      </Box>
    </>
  );
};
