"use client";

import { memo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Box, Popper, Paper, ClickAwayListener } from "@mui/material";

// Lazy-load EmojiPicker — heavy component (~500KB), only needed when picker opens
const EmojiPicker = dynamic(() => import("emoji-picker-react").then((m) => m.default), {
  ssr: false,
  loading: () => <Box sx={{ width: 380, height: 300, display: "flex", alignItems: "center", justifyContent: "center" }} />,
});

interface EmojiPickerPopperProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onEmojiClick: (emojiData: { emoji: string; imageUrl?: string }) => void;
  onClose: () => void;
  darkMode?: boolean;
}

const EmojiPickerPopperComponent = ({
  open,
  anchorEl,
  onEmojiClick,
  onClose,
  darkMode = false,
}: EmojiPickerPopperProps) => {
  const [placement, setPlacement] = useState<"top-start" | "bottom-start">("top-start");
  const [height, setHeight] = useState(400);
  const [emojiEnums, setEmojiEnums] = useState<{ EmojiStyle: any; EmojiTheme: any } | null>(null);

  // Load emoji enums dynamically when the picker opens
  useEffect(() => {
    if (!open || emojiEnums) return;
    let mounted = true;
    import("emoji-picker-react").then((m) => {
      if (mounted) setEmojiEnums({ EmojiStyle: m.EmojiStyle, EmojiTheme: m.Theme });
    });
    return () => { mounted = false; };
  }, [open, emojiEnums]);

  const handleClickAway = (event: MouseEvent | TouchEvent) => {
    if (anchorEl && anchorEl.contains(event.target as Node)) return;
    onClose();
  };

  useEffect(() => {
    if (!open || !anchorEl) return;
    const recompute = () => {
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      const margin = 12;
      const chrome = 56;
      const maxH = 430;
      const minH = 250;
      const availableDown = Math.max(0, vh - rect.bottom - margin);
      const availableUp = Math.max(0, rect.top - margin);
      const fitDown = Math.max(0, Math.min(maxH, availableDown - chrome));
      const fitUp = Math.max(0, Math.min(maxH, availableUp - chrome));
      const openDown = fitDown >= fitUp;
      setPlacement(openDown ? "bottom-start" : "top-start");
      setHeight(Math.max(minH, openDown ? fitDown : fitUp));
    };
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open, anchorEl]);

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement={placement}
      disablePortal={false}
      modifiers={[
        { name: "offset", options: { offset: [0, 10] } },
        {
          name: "flip",
          options: {
            padding: 12,
            fallbackPlacements: ["top-start", "bottom-start", "top-end", "bottom-end"],
          },
        },
        { name: "preventOverflow", options: { padding: 12, altAxis: true, boundary: "viewport" } },
      ]}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 30 }}
    >
      <ClickAwayListener onClickAway={handleClickAway}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            // Glassmorphic surface
            bgcolor: (t) =>
              t.palette.mode === "dark"
                ? "rgba(35, 35, 51, 0.82)"
                : "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            boxShadow: (t) =>
              t.palette.mode === "dark"
                ? "0px 15px 45px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
                : "0px 15px 45px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)",
            maxWidth: "min(380px, calc(100vw - 24px))",
            maxHeight: "calc(100vh - 24px)",
            border: (t) =>
              t.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(255,255,255,0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Box sx={{ width: 380, maxWidth: "100%" }}>
            {emojiEnums ? (
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                width="100%"
                height={height}
                searchDisabled={false}
                skinTonesDisabled={true}
                previewConfig={{ showPreview: true }}
                emojiStyle={emojiEnums.EmojiStyle.APPLE}
                theme={darkMode ? emojiEnums.EmojiTheme.DARK : emojiEnums.EmojiTheme.LIGHT}
              />
            ) : (
              <Box sx={{ width: 380, height, display: "flex", alignItems: "center", justifyContent: "center" }} />
            )}
          </Box>
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
};

export default memo(EmojiPickerPopperComponent);
